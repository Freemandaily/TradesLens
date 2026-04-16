{{
    config(
        materialized='incremental',
        unique_key=['id'],
        incremental_strategy='merge'
    )
}}

with all_swaps as (
    -- Uniswap V3
    select * from {{ ref('eth_v3_int') }}
    union all
    select * from {{ ref('arb_v3_int') }}
    union all
    select * from {{ ref('opt_v3_int') }}
    
    union all
    -- SushiSwap V3
    select * from {{ ref('eth_sushi_v3_int') }}
    union all
    select * from {{ ref('arb_sushi_v3_int') }}
    union all
    select * from {{ ref('opt_sushi_v3_int') }}
    
    union all
    -- Solidly V3
    select * from {{ ref('eth_solidly_v3_int') }}
),

final as (
    select
        id,
        tx_hash,
        swap_timestamp,
        timestamp,
        dex,
        chain_name,
        
        -- Trade Details
        token_bought,
        token_sold,
        token_bought_symbol,
        token_sold_symbol,
        
        -- Raw Amounts
        amount_bought,
        amount_sold,
        
        -- Metadata
        pool,
        "sqrtPriceX96",
        tick,
        "amountUSD"
        
    from all_swaps

    {% if is_incremental() %}
        where "timestamp" > (
            select max("timestamp") - 7200 from {{ this }}
        )
    {% endif %}
)

select * from final
