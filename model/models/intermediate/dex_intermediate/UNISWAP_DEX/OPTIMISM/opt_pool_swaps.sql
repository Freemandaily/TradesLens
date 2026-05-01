{{
    config(
        materialized='view'
    )
}}

with staged as (
     select * from {{ ref('stg_dex_swaps') }}
     where chain_name = 'Optimism'
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
                '0x0b2c639c533813f4aa9d7837caf62653d097ff85', -- USDC
                '0x7f5c764cbc14f9669b88837ca1490cca17c31607', -- USDC.e
                '0x94b008aa00579c1307b0ef2c499ad98a8ce58e58'  -- USDT
            ) then 'token0'
            when s.token1 in (
                '0x0b2c639c533813f4aa9d7837caf62653d097ff85',
                '0x7f5c764cbc14f9669b88837ca1490cca17c31607',
                '0x94b008aa00579c1307b0ef2c499ad98a8ce58e58'
            ) then 'token1'
            when s.token0 = '0x4200000000000000000000000000000000000006' then 'token0' -- WETH
            when s.token1 = '0x4200000000000000000000000000000000000006' then 'token1'
            else 'token1' 
        end as quote_side,

        case 
            when (case when s.token0 in ('0x0b2c639c533813f4aa9d7837caf62653d097ff85','0x7f5c764cbc14f9669b88837ca1490cca17c31607','0x94b008aa00579c1307b0ef2c499ad98a8ce58e58') then 'token0'
                       when s.token1 in ('0x0b2c639c533813f4aa9d7837caf62653d097ff85','0x7f5c764cbc14f9669b88837ca1490cca17c31607','0x94b008aa00579c1307b0ef2c499ad98a8ce58e58') then 'token1'
                       when s.token0 = '0x4200000000000000000000000000000000000006' then 'token0'
                       when s.token1 = '0x4200000000000000000000000000000000000006' then 'token1'
                       else 'token1' end) = 'token1' then s.token0
            else s.token1
        end as base_token_address,

        case 
            when (case when s.token0 in ('0x0b2c639c533813f4aa9d7837caf62653d097ff85','0x7f5c764cbc14f9669b88837ca1490cca17c31607','0x94b008aa00579c1307b0ef2c499ad98a8ce58e58') then 'token0'
                       when s.token1 in ('0x0b2c639c533813f4aa9d7837caf62653d097ff85','0x7f5c764cbc14f9669b88837ca1490cca17c31607','0x94b008aa00579c1307b0ef2c499ad98a8ce58e58') then 'token1'
                       when s.token0 = '0x4200000000000000000000000000000000000006' then 'token0'
                       when s.token1 = '0x4200000000000000000000000000000000000006' then 'token1'
                       else 'token1' end) = 'token1' then s.token0_symbol
            else s.token1_symbol
        end as base_token_symbol,

        case 
            when (case when s.token0 in ('0x0b2c639c533813f4aa9d7837caf62653d097ff85','0x7f5c764cbc14f9669b88837ca1490cca17c31607','0x94b008aa00579c1307b0ef2c499ad98a8ce58e58') then 'token0'
                       when s.token1 in ('0x0b2c639c533813f4aa9d7837caf62653d097ff85','0x7f5c764cbc14f9669b88837ca1490cca17c31607','0x94b008aa00579c1307b0ef2c499ad98a8ce58e58') then 'token1'
                       when s.token0 = '0x4200000000000000000000000000000000000006' then 'token0'
                       when s.token1 = '0x4200000000000000000000000000000000000006' then 'token1'
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
