{{
    config(
        materialized='incremental',
        unique_key=['id'],
        incremental_strategy='merge'
    )
}}

with pools as (

    select * from {{ source('dexSwap_v3', 'Pool') }}

    {% if is_incremental() %}
        where "createdAtTimestamp" > (
            select max("createdAtTimestamp") - 7200 from {{ this }}
        )
    {% endif %}

),

final as (
    select 
        split_part(id, '-', 2) as pool_address,
        case 
            when id ilike '1-%' then 'Ethereum'
            when id ilike '10-%' then 'Optimism'
            when id ilike '42161-%' then 'Arbitrum'
            else 'Unknown'
        end as chain_name,
        token0_id,
        token1_id,
        "feeTier",
        "createdAtTimestamp" as created_at_timestamp,
        to_timestamp("createdAtTimestamp") as pool_create_date,
        dex
    from pools
)

select * from final