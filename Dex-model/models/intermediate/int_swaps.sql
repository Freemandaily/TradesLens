{{
    config(
        materialized='view',
        schema='intermediate'
    )
}}

with staged as (
    select * from {{ ref('stg_dex_swaps') }}
),

swap_tx as (
    select
        id,
        swap_timestamp,
        "timestamp",
        cast(swap_timestamp as date) as swap_date,
        tx_hash,
        block_number,
        dex,
        pool_id,
        from_address,
        to_address,
        gas,

        -- Break down into Sold and Bought amounts
        -- In Uniswap V3: amount > 0 is into pool (sold), amount < 0 is out of pool (bought)
        case 
            when amount0_actual >= 0 then abs(amount0_actual)
            else abs(amount1_actual)
        end as amount_sold,

        case 
            when amount0_actual >= 0 then token0_symbol
            else token1_symbol
        end as token_sold_symbol,

        case 
            when amount0_actual >= 0 then abs(amount1_actual)
            else abs(amount0_actual)
        end as amount_bought,

        case 
            when amount0_actual >= 0 then token1_symbol
            else token0_symbol
        end as token_bought_symbol,

        -- Additional Enrichment
        token0_symbol || '-' || token1_symbol as pairing,
        
        case 
            when amount0_actual >= 0 then 'Sell ' || token0_symbol || ' for ' || token1_symbol
            else 'Buy ' || token0_symbol || ' with ' || token1_symbol
        end as swap_description,

        -- Raw data for downstream usage
        "sqrtPriceX96"                                  as sqrt_price_x96,
        tick

    from staged
)

select 
    *
from swap_tx