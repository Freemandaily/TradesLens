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
        avg_swap_volume,
        pool_create_date
        
    from all_pool_metrics
)

select 
    mt.pool,
    mt.token_pool,
    mt.base_token_address,
    mt.base_token_symbol,
    mt.chain_name,
    mt.price,
    mt.volume,
    mt.pool_revenue,
    mt.volume_24h,
    mt.volume_3d,
    mt.volume_7d,
    mt.total_buy_5m,
    mt.total_sell_5m,
    mt.total_buy_10m,
    mt.total_sell_10m,
    mt.total_buy_24h,
    mt.total_sell_24h,
    mt.avg_swap_volume,
    mt.pool_create_date,
    pc.current_price,
    pc.price_5m_ago,
    pc.price_1h_ago,
    pc.price_6h_ago,
    pc.price_24h_ago,
    pc.change_5m,
    pc.change_1h,
    pc.change_6h,
    pc.change_24h,
    pc.pct_change_5m,
    pc.pct_change_1h,
    pc.pct_change_6h,
    pc.pct_change_24h
from metrics mt
left join {{ref('price_changes')}} pc ON mt.pool = pc.pool
