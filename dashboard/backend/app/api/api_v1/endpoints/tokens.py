from fastapi import APIRouter, Path

router = APIRouter()

@router.get("/top")
def get_top_tokens():
    """
    Get trending tokens by 24h volume.
    """
    return [
        {"symbol": "WETH", "price_usd": 3250.45, "volume_24h": 1250000.0, "change_24h": -1.2},
        {"symbol": "USDC", "price_usd": 1.00, "volume_24h": 850000.0, "change_24h": 0.01}
    ]

@router.get("/{chain_id}/{address}")
def get_token_details(
    chain_id: int = Path(..., description="EVM-Chain ID"),
    address: str = Path(..., description="Token contract address")
):
    """
    Detailed metadata for a specific token on a specific chain.
    """
    return {
        "id": f"{chain_id}-{address}",
        "symbol": "WBTC",
        "name": "Wrapped Bitcoin",
        "decimals": 8,
        "tvl_usd": 4500000.0,
        "derived_eth": 15.42
    }
