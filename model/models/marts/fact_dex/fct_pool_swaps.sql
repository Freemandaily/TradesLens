{{
    config(
        materialized='table'
    )
}}

with all_pool_swaps as (
    select * from {{ ref('arb_pool_swaps') }}
    union all
    select * from {{ ref('eth_pool_swaps') }}
    union all
    select * from {{ ref('opt_pool_swaps') }}
)

select * from all_pool_swaps