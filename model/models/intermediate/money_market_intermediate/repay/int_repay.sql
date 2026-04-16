{{
    config(
        materialized='view'
    )
}}

with staged as (
    select * from {{ref('stg_repay')}}
)

select
    id,
    "contractAddress",
    token_address,
    token_name,
    token_symbol,
    user,
    amount,
    "amountUSD",
    "reserveDecimals",
    repayer,
    "useATokens",
    timestamp,
    "transactionHash",
    "txFrom",
    "txTo",
    "blockNumber",
    blockchain
from staged