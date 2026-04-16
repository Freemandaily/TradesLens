{{
    config(
        materialized='view'
    )
}}

with staged as (
    select * from {{ ref('stg_supply') }}
)

select 
    id,
    token_address,
    token_name,
    token_symbol,
    "user",
    "onBehalfOf",
    amount / Power(10,"reserveDecimals") as amount,
    "amountUSD",
    "reserveDecimals",
    "referralCode",
    timestamp,
    "transactionHash",
    "txFrom",
    "txTo",
    "blockNumber",
    blockchain
    
from staged