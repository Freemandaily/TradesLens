{{
    config(
        materialized='view'
    )
}}

with staged as (
     select * from {{ ref('stg_dex_swaps') }}
     where chain_name = 'Ethereum'
     and  dex = 'UniswapV3'
),

-- Join with Pool source to get the fee tier
pools as (
    select 
        id as pool_id,
        "feeTier"
    from {{ source('dexSwap_v3', 'Pool') }}
),

enriched as (
    select 
        s.*,
        p."feeTier",
        s.token0_symbol || '-' || s.token1_symbol  as token_pool,
        -- Determine which token is the Quote using explicit contract addresses
        case 
            when s.token0 in (
                '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', -- USDC
                '0xdac17f958d2ee523a2206206994597c13d831ec7'  -- USDT
            ) then 'token0'
            when s.token1 in (
                '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
                '0xdac17f958d2ee523a2206206994597c13d831ec7'
            ) then 'token1'
            when s.token0 = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2' then 'token0' -- WETH
            when s.token1 = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2' then 'token1'
            else 'token1' 
        end as quote_side,

        case 
            when (case when s.token0 in ('0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48','0xdac17f958d2ee523a2206206994597c13d831ec7') then 'token0'
                       when s.token1 in ('0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48','0xdac17f958d2ee523a2206206994597c13d831ec7') then 'token1'
                       when s.token0 = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2' then 'token0'
                       when s.token1 = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2' then 'token1'
                       else 'token1' end) = 'token1' then s.token0
            else s.token1
        end as base_token_address,

        case 
            when (case when s.token0 in ('0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48','0xdac17f958d2ee523a2206206994597c13d831ec7') then 'token0'
                       when s.token1 in ('0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48','0xdac17f958d2ee523a2206206994597c13d831ec7') then 'token1'
                       when s.token0 = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2' then 'token0'
                       when s.token1 = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2' then 'token1'
                       else 'token1' end) = 'token1' then s.token0_symbol
            else s.token1_symbol
        end as base_token_symbol,

        case 
            when (case when s.token0 in ('0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48','0xdac17f958d2ee523a2206206994597c13d831ec7') then 'token0'
                       when s.token1 in ('0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48','0xdac17f958d2ee523a2206206994597c13d831ec7') then 'token1'
                       when s.token0 = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2' then 'token0'
                       when s.token1 = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2' then 'token1'
                       else 'token1' end) = 'token1' then s.token1_symbol
            else s.token0_symbol
        end as quote_token_symbol
    from staged s
    left join pools p on s.pool = split_part(p.pool_id, '-', 2)
),

side_logic as (
    select 
        *,
        case 
            when quote_side = 'token1' then 
                case when amount1 > 0 then 'BUY' else 'SELL' end
            else
                case when amount0 > 0 then 'BUY' else 'SELL' end
        end as side,
        case 
            when quote_side = 'token1' then abs(amount0)
            else abs(amount1) 
        end as base_asset_amount,

        case 
            when quote_side = 'token1' then abs(amount1)
            else abs(amount0) 
        end as quote_asset_amount,

        (abs("amountUSD") * coalesce("feeTier", 0) / 1000000) as swap_revenue
    from enriched
),

final_tx as (
    select
        *,
        case 
            when base_asset_amount > 0 then "amountUSD" / base_asset_amount
            else 0 
        end as swap_price
    from side_logic
),

-- Determine current price from the single latest swap per pool
latest_prices as (
    select distinct on (pool)
        pool,
        swap_price as current_price
    from final_tx
    order by pool, swap_timestamp desc
)

select 
    f.*,
    lp.current_price as price
from final_tx f
left join latest_prices lp on f.pool = lp.pool
