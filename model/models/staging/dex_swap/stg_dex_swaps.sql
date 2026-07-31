{{ config(
    materialized='incremental',
    unique_key=['id'],
    incremental_strategy='merge'
) }}

with swaps as (

    select * from {{ source('dexSwap_v3', 'Swap') }}

    {% if is_incremental() %}
        where timestamp > (
            select max(timestamp) - 7200 from {{ this }}
        )
    {% endif %}

),

tokens as (
    select 
        case 
            when id like '1-%' then 'Ethereum'
            when id like '10-%' then 'Optimism'
            when id like '42161-%' then 'Arbitrum'
            else 'Unknown'
        end as chain_name,

        split(id, '-')[safe_offset(1)] as token_address,
        symbol,
        name,
        decimals
    from {{ source('dexSwap_v3', 'Token') }}
),

staged as (

    select
        id,

        -- Operational Metadata
        timestamp_seconds(cast(timestamp as int64))                 as swap_timestamp,
        timestamp,
        transaction_id                                   as tx_hash,
        dex,
        
        case
            when pool_id like '1-%' then 'Ethereum'
            when pool_id like '10-%' then 'Optimism'
            when pool_id like '42161-%' then 'Arbitrum'
            else 'Unknown'
        end as chain_name,
        gasPrice,
        sender,
        recipient,
        txFrom,
        -- Raw and normalized  
        amount0,
        amount1,
        amountUSD,
        split(token0_id, '-')[safe_offset(1)] as token0,
        split(token1_id, '-')[safe_offset(1)] as token1,
        split(pool_id, '-')[safe_offset(1)] as pool,
        -- Price and tick data
        sqrtPriceX96,
        tick

    from swaps

),

enriched_swaps as (
    select
        id,
        swap_timestamp,
        timestamp,
        tx_hash,
        dex,
        s.chain_name,
        gasPrice,
        sender,
        recipient,
        txFrom,
        amount0,
        amount1,
        amountUSD,
        token0,
        token1,
        pool,
        sqrtPriceX96,
        tick,
        t0.symbol as token0_symbol,
        t0.name as token0_name,
        t0.decimals as token0_decimals,
        t1.symbol as token1_symbol,
        t1.name as token1_name,
        t1.decimals as token1_decimals
    from staged s
    left join tokens t0 
        on s.token0 = t0.token_address 
        and s.chain_name = t0.chain_name
    left join tokens t1 
        on s.token1 = t1.token_address 
        and s.chain_name = t1.chain_name
)

select * from enriched_swaps