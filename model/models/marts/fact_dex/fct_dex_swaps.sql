{{
    config(
        materialized='table'
    )
}}

with all_pool_metrics as (
    -- Uniswap V3
    select * from {{ ref('eth_v3_int') }}
    union all
    select * from {{ ref('arb_v3_int') }}
    union all
    select * from {{ ref('opt_v3_int') }}
),

metrics as (
    select
        pool,
        token_pool,
        base_token_address,
        base_token_symbol,
        chain_name,
        price,
        volume,
        pool_revenue,
        volume_24h,
        volume_3d,
        volume_7d,
        total_buy_5m,
        total_sell_5m,
        total_buy_10m,
        total_sell_10m,
        total_buy_24h,
        total_sell_24h,
        avg_swap_volume
        
    from all_pool_metrics
)

select * from metrics
