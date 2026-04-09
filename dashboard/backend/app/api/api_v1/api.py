from fastapi import APIRouter
from app.api.api_v1.endpoints import (
    stats,
    swaps,
    tokens,
    pools,
    search
)

api_router = APIRouter()

api_router.include_router(stats.router, prefix="/stats", tags=["Global Statistics"])
api_router.include_router(swaps.router, prefix="/swaps", tags=["Swap Activity"])
api_router.include_router(tokens.router, prefix="/tokens", tags=["Token Intelligence"])
api_router.include_router(pools.router, prefix="/pools", tags=["Pool Insights"])
api_router.include_router(search.router, prefix="/search", tags=["Global Search"])
