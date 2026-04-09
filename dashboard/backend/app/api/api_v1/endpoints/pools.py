from fastapi import APIRouter

router = APIRouter()

@router.get("/all")
def list_active_pools():
    """
    List all tracked liquidity pools with TVL and fee tiers.
    """
    return [
        {
            "id": "1-0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640",
            "tokens": ["WETH", "USDC"],
            "fee_tier": 500,
            "tvl_usd": 125000000.0,
            "volume_24h_usd": 1500000.0,
            "dex": "Uniswap V3"
        }
    ]
