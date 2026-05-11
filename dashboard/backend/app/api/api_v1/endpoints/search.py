import logging
from typing import List, Optional, Any
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.core.database import get_db

logger = logging.getLogger(__name__)

router = APIRouter()

@router.get("/")
def universal_search(
    q: Optional[str] = Query(None, description="Search query (tx hash, address, or symbol)"),
    db: Session = Depends(get_db)
):
    """
    Unified Search & Discovery Service:
    - No query (q is None): Returns 'Latest' and 'Top' trending pools.
    - With query: Performs universal search across tx hashes, pools, and symbols.
    """
    try:
        if not q or q.strip() == "":
            # --- DISCOVERY MODE ---
            logger.info("Executing Discovery Mode (No Query)")
            
            # 1. Latest Pools (Newest deployments)
            latest_query = text("""
                SELECT 
                    pool as pool_address,
                    token_pool as pair,
                    base_token_symbol,
                    chain_name,
                    current_price as price,
                    volume as total_volume,
                    pool_create_date as created_at
                FROM fct_dex_swaps
                WHERE pool_create_date IS NOT NULL
                ORDER BY pool_create_date DESC
                LIMIT 10
            """)
            latest_res = db.execute(latest_query).all()
            
            # 2. Top Pools (Trending momentum)
            top_query = text("""
                SELECT 
                    pool as pool_address,
                    token_pool as pair,
                    base_token_symbol,
                    chain_name,
                    current_price as price,
                    volume as total_volume,
                    pool_create_date as created_at,
                    pct_change_24h,
                    pct_change_6h
                FROM fct_dex_swaps
                WHERE pct_change_6h > 0 AND pct_change_24h > 0
                  AND pool_create_date IS NOT NULL
                ORDER BY pool_create_date DESC, pct_change_24h DESC
                LIMIT 10
            """)
            top_res = db.execute(top_query).all()

            return {
                "discovery": True,
                "latest": [dict(r._mapping) for r in latest_res],
                "top": [dict(r._mapping) for r in top_res]
            }

        # --- SEARCH MODE ---
        q = q.strip()
        logger.info(f"Executing Search Mode for: {q}")
        results = []
        is_hex = q.startswith("0x")
        
        if is_hex and len(q) == 42:
            # Smart Address Search: Check if it's a Pool or a Token (bought/sold)
            # This returns the pool detail fields requested
            addr_query = text("""
                SELECT 
                    pool as pool_address,
                    token_pool as pair,
                    base_token_address,
                    base_token_symbol,
                    chain_name,
                    current_price as price,
                    volume_24h,
                    pool_create_date as created_at,
                    pct_change_1h,
                    pct_change_6h,
                    pct_change_24h,
                    'pool' as type
                FROM fct_dex_swaps 
                WHERE pool = :q 
                   OR base_token_address = :q
                ORDER BY volume_24h DESC
                LIMIT 20
            """)
            addr_res = db.execute(addr_query, {"q": q}).all()
            results = [dict(r._mapping) for r in addr_res]

        # If not an address or no address matches found, try Symbol Search
        if not results:
            token_query = text("""
                SELECT 
                    pool as pool_address,
                    token_pool as pair,
                    base_token_address,
                    base_token_symbol,
                    chain_name,
                    current_price as price,
                    volume_24h,
                    pool_create_date as created_at,
                    pct_change_1h,
                    pct_change_6h,
                    pct_change_24h,
                    'token' as type
                FROM fct_dex_swaps
                WHERE base_token_symbol ILIKE :q 
                ORDER BY volume_24h DESC
                LIMIT 15
            """)
            token_matches = db.execute(token_query, {"q": f"%{q}%"}).all()
            results = [dict(r._mapping) for r in token_matches]

        return {
            "query": q, 
            "count": len(results), 
            "results": results
        }

    except Exception as e:
        logger.error(f"UNIFIED SEARCH ERROR: {str(e)}", exc_info=True)
        return {"error": str(e), "latest": [], "top": []}

    except Exception as e:
        logger.error(f"UNIFIED SEARCH ERROR: {str(e)}", exc_info=True)
        return {"error": str(e), "latest": [], "top": []}
