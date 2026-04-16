{{
    config(
        materialized='view'
    )
}}

with staged as (
    select
        *
    from {{ref('stg_liquidation')}}
)


select 
    id,
    "contractAddress",
    collateral_asset,
    collateral_asset_name,
    collateral_asset_symbol,
    debt_asset,
    debt_asset_name,
    debt_asset_symbol,
    user,
    debt_to_cover,
    debt_to_cover_usd,
    debt_asset_decimals,
    liquidated_collateral_amount,
    liquidated_collateral_amount_usd,
    collateral_asset_decimals,
    liquidator,
    receive_a_token,
    timestamp,
    "transactionHash",
    "txFrom",
    "txTo",
    "blockNumber",
    blockchain
from staged