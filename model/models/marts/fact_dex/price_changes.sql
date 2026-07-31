{{
    config(
        materialized='view'
    )
}}

with latest_price_ordered as (
    select
        pool,
        swap_timestamp,
        swap_price,
        row_number() over (partition by pool order by swap_timestamp desc) as rn
    from {{ref('fct_pool_swaps')}}
),

latest_price as (
    select
        pool,
        swap_timestamp,
        swap_price
    from latest_price_ordered
    where rn = 1
),

price_5m_ordered as (
    select
        pool,
        swap_price as price_5m_ago,
        row_number() over (partition by pool order by swap_timestamp desc) as rn
    from {{ref('fct_pool_swaps')}}
    where swap_timestamp <= timestamp_sub(current_timestamp(), interval 5 minute)
),

price_5m as (
    select
        pool,
        price_5m_ago
    from price_5m_ordered
    where rn = 1
),

price_1h_ordered as (
    select
        pool,
        swap_price as price_1h_ago,
        row_number() over (partition by pool order by swap_timestamp desc) as rn
    from {{ref('fct_pool_swaps')}}
    where swap_timestamp <= timestamp_sub(current_timestamp(), interval 1 hour)
),

price_1h as (
    select
        pool,
        price_1h_ago
    from price_1h_ordered
    where rn = 1
),

price_6h_ordered as (
    select
        pool,
        swap_price as price_6h_ago,
        row_number() over (partition by pool order by swap_timestamp desc) as rn
    from {{ref('fct_pool_swaps')}}
    where swap_timestamp <= timestamp_sub(current_timestamp(), interval 6 hour)
),

price_6h as (
    select
        pool,
        price_6h_ago
    from price_6h_ordered
    where rn = 1
),

price_24h_ordered as (
    select
        pool,
        swap_price as price_24h_ago,
        row_number() over (partition by pool order by swap_timestamp desc) as rn
    from {{ref('fct_pool_swaps')}}
    where swap_timestamp <= timestamp_sub(current_timestamp(), interval 24 hour)
),

price_24h as (
    select
        pool,
        price_24h_ago
    from price_24h_ordered
    where rn = 1
),

changes as (
select
    l.pool,
    l.swap_timestamp                                                       as latest_timestamp,
    l.swap_price                                                                 as current_price,
    p5.price_5m_ago,
    p1.price_1h_ago,
    p6.price_6h_ago,
    p24.price_24h_ago,
    round((l.swap_price - p5.price_5m_ago), 6)                            as change_5m,
    round((l.swap_price - p1.price_1h_ago), 6)                           as change_1h,
    round((l.swap_price - p6.price_6h_ago), 6)                            as change_6h,
    round((l.swap_price - p24.price_24h_ago), 6)                           as change_24h,
    round((l.swap_price - p5.price_5m_ago)  / nullif(p5.price_5m_ago,  0) * 100, 2) as pct_change_5m,
    round((l.swap_price - p1.price_1h_ago) / nullif(p1.price_1h_ago, 0) * 100, 2) as pct_change_1h,
    round((l.swap_price - p6.price_6h_ago)  / nullif(p6.price_6h_ago,  0) * 100, 2) as pct_change_6h,
    round((l.swap_price - p24.price_24h_ago) / nullif(p24.price_24h_ago, 0) * 100, 2) as pct_change_24h

from latest_price l
left join price_5m  p5  on l.pool = p5.pool
left join price_1h p1 on l.pool = p1.pool
left join price_6h  p6  on l.pool = p6.pool
left join price_24h p24 on l.pool = p24.pool

)

select 
    pool,
    latest_timestamp,
    current_price,
    price_5m_ago,
    price_1h_ago,
    price_6h_ago,
    price_24h_ago,
    change_5m,
    change_1h,
    change_6h,
    change_24h,
    pct_change_5m,
    pct_change_1h,
    pct_change_6h,
    pct_change_24h
from changes
