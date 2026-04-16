{{
    config(
        materialized='incremental',
        unique_key='id',
        tags=['lending', 'repay', 'staging'],
        incremental_strategy='merge'
    )
}}

with source as (
    select 
        * 
    from {{ source('lending_borrowing_v3', 'Repay') }}

    {% if is_incremental() %}
        where "timestamp" > (
            select max("timestamp") - 7200 from {{this}}
        )
    {% endif %}
)

select 
    id,
    "contractAddress",
    reserve as token_address,
    "reserveName" as token_name,
    "reserveSymbol" as token_symbol,
    "user",
    amount,
    "amountUSD",
    "reserveDecimals",
    "repayer",
    "useATokens",
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