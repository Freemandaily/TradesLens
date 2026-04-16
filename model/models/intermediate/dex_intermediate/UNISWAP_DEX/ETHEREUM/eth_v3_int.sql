{{
    config(
        materialized='view'
    )
}}

with staged as (
     select * from {{ ref('stg_dex_swaps') }}
     where chain_name = 'Ethereum'
     and  dex = 'UniswapV3'
),

swap_tx as (
    select 
        id,
        swap_timestamp,
        timestamp,
        tx_hash,
        dex,
        chain_name,
        "gasPrice",
        sender,
        recipient,
        amount0,
        amount1,
        "amountUSD",

        case 
            when amount0 > 0 then amount1
            else amount0
        end as amount_bought,

        case
            when amount0 > 0 then amount0
            else amount1
        end as amount_sold,

        case 
            when amount0 > 0 then token1    
            else token0
        end as token_bought,

        case 
            when amount0 > 0 then token0
            else token1
        end as token_sold,

        case
            when amount0 > 0 then token1_symbol
            else token0_symbol
        end as token_bought_symbol,

        case
            when amount0 > 0 then token0_symbol
            else token1_symbol
        end as token_sold_symbol,

        pool,
        "sqrtPriceX96",
        tick
    from staged
)

select 
    *
from swap_tx
