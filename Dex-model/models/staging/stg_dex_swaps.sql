{{ config(
    materialized='incremental',
    unique_key=['id'],
    incremental_strategy='merge',
    schema='staging'
) }}

with swaps as (

    select * from {{ source('dexSwap_v3', 'Swap') }}

    {% if is_incremental() %}
        where "timestamp" > (
            select max("timestamp") - 7200 from {{ this }}
        )
    {% endif %}

),

staged as (

    select
        s.id,

        -- Operational Metadata
        to_timestamp(s."timestamp")                 as swap_timestamp,
        s."timestamp",
        s."txHash"                                   as tx_hash,
        s."blockNumber"                              as block_number,
        s.dex,
        s.pool_id,
        s.from                                       as from_address,
        s.to                                         as to_address,
        s.gas,
        s.sender,
        s.recipient,

        -- Raw and normalized amounts
        s.amount0,
        (s.amount0 / power(10, p.token0_decimals))  as amount0_actual,
        s.amount1,
        (s.amount1 / power(10, p.token1_decimals))  as amount1_actual,

        -- Token metadata
        p.token0_symbol,
        p.token0_name,
        p.token1_symbol,
        p.token1_name,

        -- Price and tick data
        s."sqrtPriceX96",
        s.tick

    from swaps s
    left join {{ source('dexSwap_v3', 'Pool') }} p
        on s.pool_id = p.id

)

select * from staged