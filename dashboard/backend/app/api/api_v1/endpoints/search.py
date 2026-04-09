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
    q: str = Query(..., min_length=1, description="Search query (tx hash, address, or symbol)"),
    db: Session = Depends(get_db)
):
    """
    Universal search for:
    1. Transaction hashes (exact 0x...)
    2. Pool addresses (exact 0x...)
    3. Token symbols (fuzzy partial match)
    """
    try:
        q = q.strip()
        results = []

        # 1. Detect if it's likely a hash or address
        is_hex = q.startswith("0x")
        
        if is_hex:
            # Check for Transaction Hash (66 chars)
            if len(q) == 66:
                tx_query = text("""
                    SELECT 
                        tx_hash as id,
                        'transaction' as type,
                        dex || ' Swap' as label,
                        chain_name as sublabel,
                        "amountUSD" as value,
                        token_bought_symbol as token_bought,
                        token_sold_symbol as token_sold,
                        amount_bought,
                        amount_sold,
                        timestamp
                    FROM fct_dex_swaps
                    WHERE tx_hash = :q
                    LIMIT 1
                """)
                tx_res = db.execute(tx_query, {"q": q}).first()
                if tx_res:
                    results.append(dict(tx_res._mapping))

            # Check for Pool Address (42 chars)
            elif len(q) == 42:
                pool_query = text("""
                    SELECT 
                        pool as id,
                        'pool' as type,
                        token_bought_symbol || '/' || token_sold_symbol as label,
                        dex || ' @ ' || chain_name as sublabel,
                        SUM("amountUSD") as value,
                        COUNT(*) as swap_count,
                        AVG("amountUSD") as avg_trade_size
                    FROM fct_dex_swaps
                    WHERE pool = :q
                    GROUP BY 1, 2, 3, 4
                    LIMIT 1
                """)
                pool_res = db.execute(pool_query, {"q": q}).first()
                if pool_res:
                    results.append(dict(pool_res._mapping))

        # 2. Search by Token Symbol (always do this if not enough results yet)
        if len(results) < 5:
            # Search for tokens in either bought or sold columns
            token_query = text("""
                SELECT DISTINCT 
                    symbol as id,
                    'token' as type,
                    symbol as label,
                    'Token' as sublabel,
                    SUM(vol) as value
                FROM (
                    SELECT token_bought_symbol as symbol, SUM("amountUSD") as vol 
                    FROM fct_dex_swaps WHERE token_bought_symbol ILIKE :q GROUP BY 1
                    UNION ALL
                    SELECT token_sold_symbol as symbol, SUM("amountUSD") as vol 
                    FROM fct_dex_swaps WHERE token_sold_symbol ILIKE :q GROUP BY 1
                ) t
                GROUP BY 1, 2, 3, 4
                ORDER BY value DESC
                LIMIT 10
            """)
            token_matches = db.execute(token_query, {"q": f"%{q}%"}).all()
            for r in token_matches:
                # Avoid duplicates if we already found this via address (unlikely here but good practice)
                if not any(res["id"] == r.id for res in results):
                    results.append(dict(r._mapping))

        return {
            "query": q,
            "count": len(results),
            "results": results
        }

    except Exception as e:
        logger.error(f"SEARCH ERROR: {str(e)}", exc_info=True)
        return {"query": q, "count": 0, "results": [], "error": str(e)}
