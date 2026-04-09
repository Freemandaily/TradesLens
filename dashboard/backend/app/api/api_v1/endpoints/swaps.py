import logging
from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.core.database import get_db

logger = logging.getLogger(__name__)

router = APIRouter()

@router.get("/list")
def get_swaps_list(
    chain_name: Optional[str] = Query(None, description="Filter by chain (e.g. Ethereum, Optimism)"),
    dex: Optional[str] = Query(None, description="Filter by DEX (e.g. UniswapV3, SushiV3)"),
    min_usd: Optional[float] = Query(None, description="Minimum USD amount to filter (e.g. 1000)"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db)
):
    """
    Get a paginated list of recent swap events with optional filters.
    """
    try:
        where_clauses = []
        params = {"limit": limit, "offset": offset}

        if chain_name:
            where_clauses.append("chain_name = :chain_name")
            params["chain_name"] = chain_name
        if dex:
            where_clauses.append("dex = :dex")
            params["dex"] = dex
        if min_usd:
            where_clauses.append("\"amountUSD\" >= :min_usd")
            params["min_usd"] = min_usd

        where_stmt = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""

        query = text(f"""
            SELECT 
                tx_hash,
                TO_TIMESTAMP("timestamp") as swap_time,
                chain_name,
                dex,
                token_bought_symbol,
                token_sold_symbol,
                amount_bought,
                amount_sold,
                "amountUSD" as amount_usd,
                pool
            FROM fct_dex_swaps
            {where_stmt}
            ORDER BY "timestamp" DESC
            LIMIT :limit OFFSET :offset
        """)

        results = db.execute(query, params).all()
        
        return [
            {
                "tx_hash": r.tx_hash,
                "timestamp": r.swap_time.replace(tzinfo=timezone.utc) if r.swap_time else None,
                "chain": r.chain_name,
                "dex": r.dex,
                "token_bought": r.token_bought_symbol,
                "token_sold": r.token_sold_symbol,
                "amount_bought": float(r.amount_bought) if r.amount_bought else 0.0,
                "amount_sold": float(r.amount_sold) if r.amount_sold else 0.0,
                "amount_usd": float(r.amount_usd) if r.amount_usd else 0.0,
                "pool": r.pool
            }
            for r in results
        ]
    except Exception as e:
        logger.error(f"SWAP LIST ERROR: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/analytics")
def get_swaps_analytics(
    chain_name: Optional[str] = Query(None, description="Chain filter"),
    dex: Optional[str] = Query(None, description="DEX filter"),
    year: int = Query(2025, description="Year to analyze"),
    month: Optional[int] = Query(None, ge=1, le=12, description="Month filter"),
    db: Session = Depends(get_db)
):
    """
    Aggregated Swap Analytics:
    - Volume Performance (Time-series)
    - Top Performance Pools for the subset
    - Summary (Avg trade size, total volume)
    """
    try:
        # 1. Base Filters
        conditions = ["EXTRACT(YEAR FROM TO_TIMESTAMP(\"timestamp\")) = :year"]
        params = {"year": year}
        
        if month:
            conditions.append("EXTRACT(MONTH FROM TO_TIMESTAMP(\"timestamp\")) = :month")
            params["month"] = month
            grouping = 'day'
        else:
            grouping = 'month'

        if chain_name:
            conditions.append("chain_name = :chain_name")
            params["chain_name"] = chain_name
        if dex:
            conditions.append("dex = :dex")
            params["dex"] = dex

        where_stmt = f"WHERE {' AND '.join(conditions)}"

        # 2. Key Summary Stats
        summary_query = text(f"""
            SELECT 
                COUNT(*) as count,
                SUM("amountUSD") as volume,
                AVG("amountUSD") as avg_size
            FROM fct_dex_swaps
            {where_stmt}
        """)
        summary = db.execute(summary_query, params).first()

        # 3. Volume Over Time (Performance)
        time_series_query = text(f"""
            SELECT 
                DATE_TRUNC('{grouping}', TO_TIMESTAMP("timestamp")) as period,
                SUM("amountUSD") as volume
            FROM fct_dex_swaps
            {where_stmt}
            GROUP BY 1
            ORDER BY 1 ASC
        """)
        time_series = db.execute(time_series_query, params).all()

        # 4. Top Pools for this specific Chain/DEX
        top_pools_query = text(f"""
            SELECT 
                pool,
                token_bought_symbol,
                token_sold_symbol,
                SUM("amountUSD") as volume
            FROM fct_dex_swaps
            {where_stmt}
            GROUP BY 1, 2, 3
            ORDER BY volume DESC
            LIMIT 10
        """)
        
        top_pools = db.execute(top_pools_query, params).all()


        top_pools_query = text(f"""
            WITH period_ranks AS (
                SELECT 
                    DATE_TRUNC('{grouping}', TO_TIMESTAMP("timestamp")) as period,
                    LEAST(token_bought_symbol, token_sold_symbol) as t0,
                    GREATEST(token_bought_symbol, token_sold_symbol) as t1,
                    SUM("amountUSD") as volume,
                    ROW_NUMBER() OVER(
                        PARTITION BY DATE_TRUNC('{grouping}', TO_TIMESTAMP("timestamp")) 
                        ORDER BY SUM("amountUSD") DESC
                    ) as rn
                FROM fct_dex_swaps
                {where_stmt}
                GROUP BY 1, 2, 3
            )
            SELECT period, t0, t1, volume
            FROM period_ranks
            WHERE rn = 1
            ORDER BY period ASC
            """)
        top_pools_ts = db.execute(top_pools_query, params).all()

        date_format = "%Y-%m-%d" if month else "%Y-%m"

        return {
            "summary": {
                "total_swaps": summary.count or 0,
                "total_volume_usd": float(summary.volume) if summary.volume else 0.0,
                "avg_trade_size_usd": float(summary.avg_size) if summary.avg_size else 0.0
            },
            "performance_chart": [
                {"date": r.period.strftime(date_format), "volume": float(r.volume) or 0.0}
                for r in time_series
            ],
            "top_pools": [
                {
                    "pool": r.pool,
                    "pair": f"{r.token_bought_symbol}/{r.token_sold_symbol}",
                    "volume": float(r.volume) or 0.0
                }
                for r in top_pools
            ],
            "top_pools_ts": [
                {
                    "period": r.period.strftime(date_format),
                    "pair": f"{r.t0}/{r.t1}",
                    "volume": float(r.volume) or 0.0
                }
                for r in top_pools_ts
            ]
        }
    except Exception as e:
        logger.error(f"SWAP ANALYTICS ERROR: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
