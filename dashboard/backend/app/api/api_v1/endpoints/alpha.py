import logging
import asyncio
import json
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.core.database import get_db, SessionLocal

logger = logging.getLogger(__name__)

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self.broadcast_task: Optional[asyncio.Task] = None
        self.last_data = None
        self.last_hash = None

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        # Send initial data immediately to the new user if we have it
        if self.last_data:
            try:
                await websocket.send_json(self.last_data)
            except Exception:
                pass
        
        # Start the background broadcast task if not already running
        if not self.broadcast_task or self.broadcast_task.done():
            self.broadcast_task = asyncio.create_task(self.run_broadcast_loop())

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: list):
        if not self.active_connections:
            return
            
        # Create tasks for all sends so one slow connection doesn't block others
        tasks = []
        for connection in self.active_connections:
            tasks.append(connection.send_json(message))
        
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

    async def run_broadcast_loop(self):
        logger.info("STARTING GLOBAL BROADCAST LOOP")
        try:
            while True:
                if not self.active_connections:
                    # Optional: Could stop the task if no one is watching
                    # but keeping it running for "warm" first loads is fine
                    await asyncio.sleep(10)
                    continue

                db = SessionLocal()
                try:
                    current_data = fetch_alpha_metrics_data(db, limit=100)
                    current_hash = hash(str(current_data))
                    
                    if current_hash != self.last_hash:
                        logger.info("GLOBAL BROADCAST: Change detected, pushing to all clients")
                        self.last_data = current_data
                        self.last_hash = current_hash
                        await self.broadcast(current_data)
                except Exception as e:
                    logger.error(f"BROADCAST LOOP ERROR: {str(e)}")
                finally:
                    db.close()
                
                await asyncio.sleep(5)
        except asyncio.CancelledError:
            logger.info("BROADCAST LOOP STOPPED")

manager = ConnectionManager()

def fetch_alpha_metrics_data(db: Session, chain_name: Optional[str] = None, limit: int = 50, offset: int = 0):
    where_clauses = []
    params = {"limit": limit, "offset": offset}

    if chain_name:
        where_clauses.append("chain_name = :chain_name")
        params["chain_name"] = chain_name

    where_stmt = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""

    query = text(f"""
        SELECT 
            pool,
            token_pool,
            base_token_address,
            base_token_symbol,
            chain_name,
            price,
            volume as total_volume,
            pool_revenue,
            volume_24h,
            volume_3d,
            volume_7d,
            total_buy_5m,
            total_sell_5m,
            total_buy_10m,
            total_sell_10m,
            total_buy_24h,
            total_sell_24h,
            avg_swap_volume
        FROM fct_dex_swaps
        {where_stmt}
        ORDER BY volume_24h DESC
        LIMIT :limit OFFSET :offset
    """)

    results = db.execute(query, params).all()
    
    return [
        {
            "pool_address": r.pool,
            "pair": r.token_pool,
            "base_token": {
                "address": r.base_token_address,
                "symbol": r.base_token_symbol
            },
            "chain": r.chain_name,
            "current_price": float(r.price) if r.price else 0.0,
            "metrics": {
                "volume_24h": float(r.volume_24h) if r.volume_24h else 0.0,
                "volume_3d": float(r.volume_3d) if r.volume_3d else 0.0,
                "volume_7d": float(r.volume_7d) if r.volume_7d else 0.0,
                "total_volume": float(r.total_volume) if r.total_volume else 0.0,
                "revenue": float(r.pool_revenue) if r.pool_revenue else 0.0,
                "avg_swap_size": float(r.avg_swap_volume) if r.avg_swap_volume else 0.0
            },
            "pressure": {
                "buy_5m": float(r.total_buy_5m) if r.total_buy_5m else 0.0,
                "sell_5m": float(r.total_sell_5m) if r.total_sell_5m else 0.0,
                "buy_10m": float(r.total_buy_10m) if r.total_buy_10m else 0.0,
                "sell_10m": float(r.total_sell_10m) if r.total_sell_10m else 0.0,
                "buy_24h": float(r.total_buy_24h) if r.total_buy_24h else 0.0,
                "sell_24h": float(r.total_sell_24h) if r.total_sell_24h else 0.0,
            }
        }
        for r in results
    ]

router = APIRouter()

@router.get("/metrics")
def get_alpha_metrics(
    chain_name: Optional[str] = Query(None, description="Filter by blockchain (e.g. Arbitrum, Ethereum, Optimism)"),
    limit: int = Query(50, ge=1, le=2000),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db)
):
    """
    Get pool-level alpha metrics including 24h/3d/7d volumes and buy/sell pressure.
    """
    
    try:
        return fetch_alpha_metrics_data(db, chain_name, limit, offset)
    except Exception as e:
        logger.error(f"ALPHA METRICS ERROR: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.websocket("/ws")
async def alpha_metrics_ws(websocket: WebSocket):
    """
    WebSocket endpoint for real-time alpha metrics updates.
    Uses the Singleton Broadcast pattern for efficiency.
    """
    await manager.connect(websocket)
    logger.info("WEBSOCKET CONNECTED: Client joined Intelligence Tunnel")
    
    try:
        # Keep the connection alive until the client disconnects
        while True:
            # We don't expect messages from client, but we must wait to detect disconnect
            await websocket.receive_text()
            
    except WebSocketDisconnect:
        logger.info("WEBSOCKET DISCONNECTED: Client left tunnel")
    except Exception as e:
        # Client disconnects often look like generic errors here
        pass
    finally:
        manager.disconnect(websocket)
