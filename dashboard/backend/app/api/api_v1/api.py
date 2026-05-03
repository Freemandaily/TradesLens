from fastapi import APIRouter
from app.api.api_v1.endpoints import (
    stats,
    search,
    alpha,
    swaps
)

api_router = APIRouter()

api_router.include_router(stats.router, prefix="/stats", tags=["Global Statistics"])
api_router.include_router(search.router, prefix="/search", tags=["Global Search"])
api_router.include_router(alpha.router, prefix="/alpha", tags=["Alpha Intelligence"])
api_router.include_router(swaps.router, prefix="/swaps", tags=["Pool Swaps"])
