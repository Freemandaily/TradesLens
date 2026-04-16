{{
    config(
        materialized='view'
    )
}}

with staged as (
    select * from {{ref('stg_borrow')}}
)

select  
    id,
    "contractAddress",
    token_address,
    token_name,
    token_symbol,
    user,
    "onBehalfOf",
    amount,
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