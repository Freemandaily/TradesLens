import { ONE_BI, ZERO_BD, ZERO_BI } from './constants';
import {
    Factory,
    handlerContext,
    Pool,
    PoolDayData,
    DexDayData,
} from 'generated';

// ─────────────────────────────────────────────────────────────────────────────
// Pool Day Data — tracks per-pool activity every calendar day
// ─────────────────────────────────────────────────────────────────────────────
export async function updatePoolDayData(
    timestamp: number,
    pool: Pool,
    context: handlerContext
): Promise<PoolDayData> {
    const dayId = Math.floor(timestamp / 86400);
    const dayStartTimestamp = dayId * 86400;
    const id = `${pool.id}-${dayId}`;

    const existing = await context.PoolDayData.get(id);

    // Compute final OHLC values before object construction (entities are read-only)
    const high = existing ? (pool.token0Price.gt(existing.high) ? pool.token0Price : existing.high) : pool.token0Price;
    const low = existing ? (pool.token0Price.lt(existing.low) ? pool.token0Price : existing.low) : pool.token0Price;
    const txCount = existing ? existing.txCount + ONE_BI : ONE_BI;

    const pdd: PoolDayData = {
        id,
        date: dayStartTimestamp,
        pool_id: pool.id,
        dex: pool.dex,
        liquidity: pool.liquidity,
        sqrtPrice: pool.sqrtPrice,
        token0Price: pool.token0Price,
        token1Price: pool.token1Price,
        tick: pool.tick,
        tvlUSD: pool.totalValueLockedUSD,
        volumeToken0: existing ? existing.volumeToken0 : ZERO_BD,
        volumeToken1: existing ? existing.volumeToken1 : ZERO_BD,
        volumeUSD: existing ? existing.volumeUSD : ZERO_BD,
        feesUSD: existing ? existing.feesUSD : ZERO_BD,
        txCount,
        swapCount: existing ? existing.swapCount : ZERO_BI,
        openingPrice: existing ? existing.openingPrice : pool.token0Price,
        high,
        low,
        close: pool.token0Price,
    };

    context.PoolDayData.set(pdd);
    return pdd;
}

// ─────────────────────────────────────────────────────────────────────────────
// Dex Day Data — protocol-level aggregate per DEX per day
// ─────────────────────────────────────────────────────────────────────────────
export async function updateDexDayData(
    timestamp: number,
    chainId: number,
    factory: Factory,
    context: handlerContext
): Promise<DexDayData> {
    const dayId = Math.floor(timestamp / 86400);
    const dayStartTimestamp = dayId * 86400;
    const id = `${chainId}-${factory.dex}-${dayId}`;

    const existing = await context.DexDayData.get(id);

    const ddd: DexDayData = {
        id,
        date: dayStartTimestamp,
        dex: factory.dex,
        volumeUSD: existing ? existing.volumeUSD : ZERO_BD,
        volumeETH: existing ? existing.volumeETH : ZERO_BD,
        feesUSD: existing ? existing.feesUSD : ZERO_BD,
        txCount: factory.txCount,
        tvlUSD: factory.totalValueLockedUSD,
    };

    context.DexDayData.set(ddd);
    return ddd;
}
