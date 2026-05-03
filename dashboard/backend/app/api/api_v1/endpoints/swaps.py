import logging
import asyncio
import datetime
from typing import List, Optional, Dict, Tuple
from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
from sqlalchemy import text
import urllib.request
import json
from fastapi.concurrency import run_in_threadpool
from app.core.database import get_db, SessionLocal

logger = logging.getLogger(__name__)

router = APIRouter()

GECKO_MAP = {
    "ethereum": "eth",
    "arbitrum": "arbitrum",
    "optimism": "optimism",
    "base": "base"
}

# Simple In-Memory Cache to prevent 429 Too Many Requests
# Cache format: {key: (timestamp, data)}
trending_cache = {}
info_cache = {}
CACHE_TTL = datetime.timedelta(minutes=1)

@router.get("/market-trending/{chain}")
async def get_market_trending(chain: str, db: Session = Depends(get_db)):
    """
    Fetch top pools by 24h volume from internal database (fct_dex_swaps).
    """
    # Normalize chain name for DB query (Title Case)
    target_chain = chain.strip().capitalize()
    
    # Check Cache first
    now = datetime.datetime.now()
    if target_chain in trending_cache:
        ts, data = trending_cache[target_chain]
        if now - ts < CACHE_TTL:
            return data

    try:
        # Query top 10 pools by 24h volume for this chain
        query = text("""
            SELECT 
                pool, token_pool, base_token_symbol, volume_24h, price
            FROM fct_dex_swaps
            WHERE chain_name = :chain
            ORDER BY volume_24h DESC
            LIMIT 10
        """)
        
        results = db.execute(query, {"chain": target_chain}).all()
        
        pools = []
        for r in results:
            pools.append({
                "pool_address": r.pool,
                "pair": r.token_pool,
                "symbol": r.base_token_symbol,
                "image_url": None, # We don't store logos in DB
                "price_change_24h": 0.0 # Not available in aggregated table
            })
        
        # Update Cache
        trending_cache[target_chain] = (now, pools)
        return pools
    except Exception as e:
        logger.error(f"TRENDING DB ERROR: {str(e)}")
        if target_chain in trending_cache:
            return trending_cache[target_chain][1]
        return []

class PoolConnectionManager:
    def __init__(self):
        # Dictionary to track active connections per pool: {(chain, pool_address): [list of websockets]}
        self.connections: Dict[Tuple[str, str], List[WebSocket]] = {}
        # Background task to poll for new swaps
        self.poll_task: Optional[asyncio.Task] = None
        # Track the latest timestamp we've seen per pool to only fetch NEW swaps
        self.last_seen_timestamps: Dict[Tuple[str, str], datetime.datetime] = {}

    def _get_key(self, chain: str, pool: str) -> Tuple[str, str]:
        """Normalize keys for consistency."""
        # Note: chain_name in stg/fct models are Title Case (Ethereum, Arbitrum, Optimism)
        return (chain.strip().capitalize(), pool.strip().lower())

    async def connect(self, websocket: WebSocket, chain: str, pool: str):
        await websocket.accept()
        key = self._get_key(chain, pool)
        
        if key not in self.connections:
            self.connections[key] = []
            # Initialize timestamp with "now" so we only broadcast swaps happening AFTER connection
            # If user wants history, they should use the /list endpoint
            self.last_seen_timestamps[key] = datetime.datetime.now(datetime.timezone.utc)
            
        self.connections[key].append(websocket)
        logger.info(f"Client connected to pool: {key[1]} on {key[0]}. Active pools: {len(self.connections)}")
        
        # Start the background polling task if it's not running
        if not self.poll_task or self.poll_task.done():
            self.poll_task = asyncio.create_task(self.run_polling_loop())

    def disconnect(self, websocket: WebSocket, chain: str, pool: str):
        key = self._get_key(chain, pool)
        if key in self.connections:
            self.connections[key].remove(websocket)
            if not self.connections[key]:
                logger.info(f"No more listeners for pool {key[1]}. Cleaning up.")
                del self.connections[key]
                if key in self.last_seen_timestamps:
                    del self.last_seen_timestamps[key]

    async def run_polling_loop(self):
        """
        Background worker that polls the database for new swaps 
        for ALL currently watched pools in a single efficient query.
        """
        logger.info("Starting Swaps Dispatcher Loop")
        try:
            while self.connections:
                db = SessionLocal()
                try:
                    active_keys = list(self.connections.keys())
                    if not active_keys:
                        await asyncio.sleep(5)
                        continue

                    # Construct a query to fetch NEW swaps for only the active pools
                    # We check for swaps in the last 2 minutes as a safety buffer
                    query = text("""
                        SELECT 
                            id, tx_hash, swap_timestamp, token_pool, 
                            base_token_symbol, quote_token_symbol,
                            side, base_asset_amount, quote_asset_amount,
                            swap_price, "amountUSD", chain_name, pool, "txFrom"
                        FROM fct_pool_swaps
                        WHERE (chain_name, pool) IN :pool_list
                        AND swap_timestamp > NOW() - INTERVAL '2 minutes'
                        ORDER BY swap_timestamp DESC
                    """)
                    
                    # Formatting active_keys for SQLAlchemy IN clause Tuple match
                    params = {"pool_list": tuple(active_keys)}
                    results = db.execute(query, params).all()
                    
                    # Group results by pool for distribution
                    updates_per_pool = {}
                    for r in results:
                        key = (r.chain_name, r.pool.lower())
                        
                        # Only include if it's strictly newer than what we've already sent to this pool's listeners
                        if key in self.last_seen_timestamps and r.swap_timestamp > self.last_seen_timestamps[key]:
                            if key not in updates_per_pool:
                                updates_per_pool[key] = []
                            
                            updates_per_pool[key].append({
                                "id": r.id,
                                "tx_hash": r.tx_hash,
                                "timestamp": r.swap_timestamp.isoformat(),
                                "pair": r.token_pool,
                                "base": r.base_token_symbol,
                                "quote": r.quote_token_symbol,
                                "side": r.side,
                                "amount_base": float(r.base_asset_amount),
                                "amount_quote": float(r.quote_asset_amount),
                                "price": float(r.swap_price),
                                "usd_value": float(r.amountUSD),
                                "tx_from": r.txFrom
                            })

                    # Send targeted broadcasts
                    for key, swaps in updates_per_pool.items():
                        # Update the bookmark for this pool
                        newest_ts = max([datetime.datetime.fromisoformat(s["timestamp"]) for s in swaps])
                        self.last_seen_timestamps[key] = newest_ts
                        
                        # Dispatch to only the relevant WebSockets
                        if key in self.connections:
                            tasks = [ws.send_json({"type": "new_swaps", "data": swaps}) for ws in self.connections[key]]
                            await asyncio.gather(*tasks, return_exceptions=True)

                except Exception as e:
                    logger.error(f"Swaps Polling Error: {str(e)}")
                finally:
                    db.close()
                
                await asyncio.sleep(4) # Check every 4 seconds
        except asyncio.CancelledError:
            logger.info("Swaps Dispatcher Loop stopped")
        except Exception as e:
            logger.error(f"Fatal Dispatcher Loop error: {str(e)}")

manager = PoolConnectionManager()

@router.get("/list/{chain}/{pool_address}")
def list_pool_swaps(
    chain: str,
    pool_address: str,
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db)
):
    """Fetch trade history for a specific pool."""
    query = text("""
        SELECT 
            id, tx_hash, swap_timestamp, token_pool, 
            base_token_symbol, quote_token_symbol,
            side, base_asset_amount, quote_asset_amount,
            swap_price, "amountUSD", "txFrom"
        FROM fct_pool_swaps
        WHERE chain_name = :chain AND pool = :pool
        ORDER BY swap_timestamp DESC
        LIMIT :limit
    """)
    
    params = {
        "chain": chain.strip().capitalize(),
        "pool": pool_address.strip().lower(),
        "limit": limit
    }
    
    results = db.execute(query, params).all()
    
    return [
        {
            "id": r.id,
            "tx_hash": r.tx_hash,
            "timestamp": r.swap_timestamp,
            "pair": r.token_pool,
            "base": r.base_token_symbol,
            "quote": r.quote_token_symbol,
            "side": r.side,
            "amount_base": float(r.base_asset_amount),
            "amount_quote": float(r.quote_asset_amount),
            "price": float(r.swap_price),
            "usd_value": float(r.amountUSD),
            "tx_from": r.txFrom
        } for r in results
    ]

@router.websocket("/ws/{chain}/{pool_address}")
async def pool_swaps_websocket(websocket: WebSocket, chain: str, pool_address: str):
    """
    WebSocket for specific pool monitoring.
    Connect here to receive real-time swaps for a particular pool.
    """
    await manager.connect(websocket, chain, pool_address)
    try:
        while True:
            # Maintain connection, wait for disconnect
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, chain, pool_address)
    except Exception:
        manager.disconnect(websocket, chain, pool_address)


@router.get("/pool-info/{chain}/{pool_address}")
async def get_gecko_pool_info(chain: str, pool_address: str):
    """
    Proxy to fetch pool intelligence metrics and metadata from GeckoTerminal.
    """
    network = GECKO_MAP.get(chain.lower(), "eth")
    
    # Check Cache
    cache_key = f"{network}_{pool_address.lower()}"
    now = datetime.datetime.now()
    if cache_key in info_cache:
        ts, data = info_cache[cache_key]
        if now - ts < CACHE_TTL:
            return data

    metrics_url = f"https://api.geckoterminal.com/api/v2/networks/{network}/pools/{pool_address}?include=base_token"
    info_url = f"https://api.geckoterminal.com/api/v2/networks/{network}/pools/{pool_address}/info"
    
    def fetch(url):
        headers = {
            "Accept": "application/json;version=20230302",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=10) as response:
            return json.loads(response.read().decode())

    try:
        metrics = await run_in_threadpool(fetch, metrics_url)
        # Attempt to get metadata, but don't fail if it's missing
        try:
            info = await run_in_threadpool(fetch, info_url)
            if info and "data" in info:
                metrics["metadata"] = info["data"]
        except Exception as info_err:
            logger.warning(f"Metadata fetch failed for {pool_address}: {info_err}")
            
        # Update Cache
        info_cache[cache_key] = (now, metrics)
        return metrics
    except Exception as e:
        logger.error(f"GECKO API ERROR: {str(e)}")
        # Return stale cache if available on error
        if cache_key in info_cache:
            return info_cache[cache_key][1]
        raise HTTPException(status_code=503, detail="GeckoTerminal service unavailable")
