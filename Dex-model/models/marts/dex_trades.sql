{{
    config(
        materialized='incremental',
        schema='marts',
        unique_key=['id'],
        incremental_strategy='merge'
    )
}}

with int_swaps as (
    select * from {{ ref('int_swaps') }}

    {% if is_incremental() %}
        where "timestamp" > (
            select max("timestamp") - 7200 from {{ this }}
        )
    {% endif %}
)

select
    swap_timestamp              as block_time,
    tx_hash,
    block_number                as block_number,
    "timestamp",
    dex                         as protocol,
    from_address,
    to_address,
    token_bought_symbol         as token_bought,
    token_sold_symbol           as token_sold,
    amount_bought,
    amount_sold,
    pool_id                     as pool_address,
    pairing                     as pairs,
    sqrt_price_x96,
    tick,
    id
from int_swaps