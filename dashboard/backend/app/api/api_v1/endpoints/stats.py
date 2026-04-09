import logging
from typing import List, Optional
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.core.database import get_db

logger = logging.getLogger(__name__)

# Chain mapping for Envio's chain IDs
CHAIN_MAPPING = {
    1: "Ethereum",
    10: "Optimism",
    42161: "Arbitrum",
    137: "Polygon",
    56: "BNB Smart Chain",
    8453: "Base"
}

router = APIRouter()

@router.get("/overview/summary")
def get_stats_summary(db: Session = Depends(get_db)):
    """
    Headline Stats (Summary):
    - Total Ecosystem Volume & Swaps (fct_dex_swaps)
    - Chain & DEX Distribution
    """
    try:
        logger.info("FETCHING SUMMARY FROM fct_dex_swaps...")
        
        # 1. TVL - Set to 0 as Pool table is currently missing
        total_tvl = 0.0

        # 2. Global Swaps & Volume from fact table
        swaps_query = text('SELECT COUNT(*), SUM("amountUSD") FROM fct_dex_swaps')
        swaps_res = db.execute(swaps_query).first()
        total_swaps = swaps_res[0] or 0
        total_volume = swaps_res[1] or 0.0

        # 3. Volume per Chain
        chain_vol_query = text('''
            SELECT 
                chain_name, 
                SUM("amountUSD") as volume 
            FROM fct_dex_swaps 
            GROUP BY 1 
            ORDER BY volume DESC
        ''')
        chain_vols = db.execute(chain_vol_query).all()
        
        volume_by_chain = [
            {"chain": row.chain_name, "volume": float(row.volume) if row.volume else 0.0} 
            for row in chain_vols
        ]

        # 4. Volume per DEX
        dex_vol_query = text('SELECT dex, SUM("amountUSD") as volume FROM fct_dex_swaps GROUP BY 1 ORDER BY volume DESC')
        dex_vols = db.execute(dex_vol_query).all()

        return {
            "total_tvl_usd": float(total_tvl),
            "total_volume_usd": float(total_volume),
            "total_swaps": total_swaps,
            "chains_tracked": len(volume_by_chain),
            "volume_by_chain": volume_by_chain,
            "volume_by_dex": [{"dex": r.dex, "volume": float(r.volume) or 0.0} for r in dex_vols]
        }
    except Exception as e:
        logger.error(f"SUMMARY ERROR: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

@router.get("/overview/analytics")
def get_stats_analytics(
    year: int = Query(2025, description="Year to analyze (e.g. 2025)"),
    month: Optional[int] = Query(None, ge=1, le=12, description="Optional month (1-12) to analyze deeper"),
    db: Session = Depends(get_db)
):
    """
    Deeper Insights (Analytics) with dynamic granularity:
    - If only Year is selected: Returns Volume per Month
    - If Year + Month is selected: Returns Volume per Day
    - Always returns Top 10 Token Pairs for that period
    """
    try:
        # 1. Determine Filtering and Granularity logic
        if month:
            grouping = 'day'
            where_clause = 'EXTRACT(YEAR FROM TO_TIMESTAMP("timestamp")) = :year AND EXTRACT(MONTH FROM TO_TIMESTAMP("timestamp")) = :month'
        else:
            grouping = 'month'
            where_clause = 'EXTRACT(YEAR FROM TO_TIMESTAMP("timestamp")) = :year'

        # 2. Volume Over Time Query
        time_series_query = text(f'''
            SELECT 
                DATE_TRUNC('{grouping}', TO_TIMESTAMP("timestamp")) as period,
                SUM("amountUSD") as volume,
                COUNT(*) as swaps
            FROM fct_dex_swaps
            WHERE {where_clause}
            GROUP BY 1
            ORDER BY 1 ASC
        ''')
        time_series = db.execute(time_series_query, {"year": year, "month": month}).all()

        # 3. Leaderboard (Overall Top 10 pairs for the rank)
        top_ranked_query = text(f'''
            SELECT 
                LEAST(token_bought_symbol, token_sold_symbol) as t0,
                GREATEST(token_bought_symbol, token_sold_symbol) as t1,
                SUM("amountUSD") as volume,
                COUNT(*) as count
            FROM fct_dex_swaps
            WHERE {where_clause}
            GROUP BY 1, 2
            ORDER BY volume DESC
            LIMIT 10
        ''')
        top_ranked = db.execute(top_ranked_query, {"year": year, "month": month}).all()

        # 4. Top Pairs Time-Series (Winner per Period for plotting)
        top_pairs_ts_query = text(f'''
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
                WHERE {where_clause}
                GROUP BY 1, 2, 3
            )
            SELECT period, t0, t1, volume
            FROM period_ranks
            WHERE rn = 1
            ORDER BY period ASC
        ''')
        top_pairs_ts = db.execute(top_pairs_ts_query, {"year": year, "month": month}).all()

        # 5. Peak Trading Hours Query
        peak_hours_query = text(f'''
            SELECT 
                EXTRACT(HOUR FROM TO_TIMESTAMP("timestamp")) as hour,
                SUM("amountUSD") as volume,
                COUNT(*) as count
            FROM fct_dex_swaps
            WHERE {where_clause}
            GROUP BY 1
            ORDER BY 1 ASC
        ''')
        peak_hours = db.execute(peak_hours_query, {"year": year, "month": month}).all()

        # Formatting Response
        date_format = "%Y-%m-%d" if month else "%Y-%m"
        
        return {
            "period": f"{year}-{month}" if month else f"{year}",
            "volume_over_time": [
                {"date": r.period.strftime(date_format), "volume": float(r.volume) or 0.0, "swaps": r.swaps} 
                for r in time_series
            ],
            "top_pairs_leaderboard": [
                {
                    "pair": f"{r.t0}/{r.t1}", 
                    "volume": float(r.volume) or 0.0, 
                    "swaps": r.count
                }
                for r in top_ranked
            ],
            "top_pairs_time_series": [
                {
                    "date": r.period.strftime(date_format),
                    "pair": f"{r.t0}/{r.t1}",
                    "volume": float(r.volume) or 0.0
                }
                for r in top_pairs_ts
            ],
            "hourly_distribution": [
                {"hour": int(r.hour), "volume": float(r.volume) or 0.0, "swaps": r.count}
                for r in peak_hours
            ]
        }
    except Exception as e:
        logger.error(f"ANALYTICS ERROR: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")
