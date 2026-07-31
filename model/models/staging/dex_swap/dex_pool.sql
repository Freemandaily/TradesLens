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
        where createdAtTimestamp > (
            select max(createdAtTimestamp) - 7200 from {{ this }}
        )
    {% endif %}

),

final as (
    select 
        id,
        split(id, '-')[safe_offset(1)] as pool_address,
        case 
            when id like '1-%' then 'Ethereum'
            when id like '10-%' then 'Optimism'
            when id like '42161-%' then 'Arbitrum'
            else 'Unknown'
        end as chain_name,
        token0_id,
        token1_id,
        feeTier,
        createdAtTimestamp,
        timestamp_seconds(cast(createdAtTimestamp as int64)) as pool_create_date,
        dex
    from pools
)

select * from final