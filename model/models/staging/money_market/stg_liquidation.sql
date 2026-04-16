{{
    config(
        materialized='incremental',
        unique_key='id',
        tags=['lending', 'liquidation', 'staging'],
        incremental_strategy='merge'
    )
}}

with source as (
    select 
        * 
    from {{ source('lending_borrowing_v3', 'Liquidation') }}

    {% if is_incremental() %}
        where "timestamp" > (
            select max("timestamp") - 7200 from {{this}}
        )
    {% endif %}
)

select 
    id,
    "contractAddress",
    "collateralAsset" as collateral_asset,
    "collateralAssetName" as collateral_asset_name,
    "collateralAssetSymbol" as collateral_asset_symbol,
    "debtAsset" as debt_asset,
    "debtAssetName" as debt_asset_name,
    "debtAssetSymbol" as debt_asset_symbol,
    "user",
    "debtToCover" as debt_to_cover,
    "debtToCoverUSD" as debt_to_cover_usd,
    "debtAssetDecimals" as debt_asset_decimals,
    "liquidatedCollateralAmount" as liquidated_collateral_amount,
    "liquidatedCollateralAmountUSD" as liquidated_collateral_amount_usd,
    "collateralAssetDecimals" as collateral_asset_decimals,
    "liquidator",
    "receiveAToken" as receive_a_token,
    timestamp,
    "transactionHash",
    "txFrom",
    "txTo",
    "blockNumber",
    
    case 
        when "chainId" = 1 then 'Ethereum'
        when "chainId" = 10 then 'Optimism'
        else 'Unknown'
    end blockchain
from source