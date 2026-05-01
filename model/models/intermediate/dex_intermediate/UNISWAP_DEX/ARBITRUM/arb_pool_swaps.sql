{{
    config(
        materialized='view'
    )
}}

with staged as (
     select * from {{ ref('stg_dex_swaps') }}
     where chain_name = 'Arbitrum'
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
                '0xaf88d065e77c8cc2239327c5edb3a432268e5831', -- USDC (Native)
                '0xff970a61a04b1ca14834a43f5de4533ebddb5cc8', -- USDC.e (Bridged)
                '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9'  -- USDT / USD₮0
            ) then 'token0'
            when s.token1 in (
                '0xaf88d065e77c8cc2239327c5edb3a432268e5831',
                '0xff970a61a04b1ca14834a43f5de4533ebddb5cc8',
                '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9'
            ) then 'token1'
            when s.token0 = '0x82af49447d8a07e3bd95bd0d56f35241523fbab1' then 'token0'
            when s.token1 = '0x82af49447d8a07e3bd95bd0d56f35241523fbab1' then 'token1'
            else 'token1' 
        end as quote_side,

        case 
            when (case when s.token0 in ('0xaf88d065e77c8cc2239327c5edb3a432268e5831','0xff970a61a04b1ca14834a43f5de4533ebddb5cc8','0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9') then 'token0'
                       when s.token1 in ('0xaf88d065e77c8cc2239327c5edb3a432268e5831','0xff970a61a04b1ca14834a43f5de4533ebddb5cc8','0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9') then 'token1'
                       when s.token0 = '0x82af49447d8a07e3bd95bd0d56f35241523fbab1' then 'token0'
                       when s.token1 = '0x82af49447d8a07e3bd95bd0d56f35241523fbab1' then 'token1'
                       else 'token1' end) = 'token1' then s.token0
            else s.token1
        end as base_token_address,

        case 
            when (case when s.token0 in ('0xaf88d065e77c8cc2239327c5edb3a432268e5831','0xff970a61a04b1ca14834a43f5de4533ebddb5cc8','0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9') then 'token0'
                       when s.token1 in ('0xaf88d065e77c8cc2239327c5edb3a432268e5831','0xff970a61a04b1ca14834a43f5de4533ebddb5cc8','0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9') then 'token1'
                       when s.token0 = '0x82af49447d8a07e3bd95bd0d56f35241523fbab1' then 'token0'
                       when s.token1 = '0x82af49447d8a07e3bd95bd0d56f35241523fbab1' then 'token1'
                       else 'token1' end) = 'token1' then s.token0_symbol
            else s.token1_symbol
        end as base_token_symbol,

        case 
            when (case when s.token0 in ('0xaf88d065e77c8cc2239327c5edb3a432268e5831','0xff970a61a04b1ca14834a43f5de4533ebddb5cc8','0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9') then 'token0'
                       when s.token1 in ('0xaf88d065e77c8cc2239327c5edb3a432268e5831','0xff970a61a04b1ca14834a43f5de4533ebddb5cc8','0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9') then 'token1'
                       when s.token0 = '0x82af49447d8a07e3bd95bd0d56f35241523fbab1' then 'token0'
                       when s.token1 = '0x82af49447d8a07e3bd95bd0d56f35241523fbab1' then 'token1'
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