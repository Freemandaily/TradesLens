import { UniswapV3Factory, SolidlyV3Factory, SushiV3Factory } from "generated";
import { ZERO_BD, ZERO_BI, ONE_BI } from "./utils/constants";
import { CHAIN_CONFIGS } from "./utils/chains";
import { isAddressInList } from "./utils/index";
import { getTokensMetadataEffect } from "./utils/getTokensMetadataEffect";

// ─────────────────────────────────────────────────────────────────────────────
// Shared handler — creates Pool, Token (×2), Bundle on first pool
// ─────────────────────────────────────────────────────────────────────────────
const handlePoolCreated = async (
    { event, context }: any,
    dexName: string
) => {
    const chainId = event.chainId;
    const cfg = CHAIN_CONFIGS[chainId];
    if (!cfg) return;

    const { token0: token0Address, token1: token1Address, fee, pool: poolAddress } = event.params;

    if (isAddressInList(poolAddress, cfg.poolsToSkip)) return;

    // 1. Check database for existing tokens
    const [token0RO, token1RO] = await Promise.all([
        context.Token.get(`${chainId}-${token0Address.toLowerCase()}`),
        context.Token.get(`${chainId}-${token1Address.toLowerCase()}`),
    ]);

    // One Bundle per chain (shared across DEXes)
    const bundleExists = await context.Bundle.get(chainId.toString());
    if (!bundleExists) {
        context.Bundle.set({
            id: chainId.toString(),
            ethPriceUSD: ZERO_BD
        });
    }

    // 2. Resolve Metadata — Fetch BOTH in a single multicall if either is missing
    let meta0, meta1;
    if (!token0RO || !token1RO) {
        const overrides = {
            o0: cfg.tokenOverrides.find(o => o.address.toLowerCase() === token0Address.toLowerCase()),
            o1: cfg.tokenOverrides.find(o => o.address.toLowerCase() === token1Address.toLowerCase()),
        };

        // Fetch using the optimized multicall effect if not fully overridden
        if (overrides.o0 && overrides.o1) {
            meta0 = overrides.o0;
            meta1 = overrides.o1;
        } else {
            const results = await context.effect(getTokensMetadataEffect, {
                token0: token0Address,
                token1: token1Address,
                chainId,
            });
            meta0 = overrides.o0 || results.meta0;
            meta1 = overrides.o1 || results.meta1;
        }
    }

    // ── Token 0 ──────────────────────────────────────────────────────────────
    const token0Id = `${chainId}-${token0Address.toLowerCase()}`;
    let token0;
    if (token0RO) {
        token0 = { ...token0RO };
    } else {
        token0 = {
            id: token0Id,
            symbol: meta0!.symbol,
            name: meta0!.name,
            decimals: BigInt(meta0!.decimals),
            isWhitelisted: isAddressInList(token0Address, cfg.whitelistTokens),
            volume: ZERO_BD,
            volumeUSD: ZERO_BD,
            untrackedVolumeUSD: ZERO_BD,
            feesUSD: ZERO_BD,
            txCount: ZERO_BI,
            poolCount: ZERO_BI,
            totalValueLocked: ZERO_BD,
            totalValueLockedUSD: ZERO_BD,
            totalValueLockedUSDUntracked: ZERO_BD,
            derivedETH: ZERO_BD,
            whitelistPools: [] as string[],
        };
    }

    // ── Token 1 ──────────────────────────────────────────────────────────────
    const token1Id = `${chainId}-${token1Address.toLowerCase()}`;
    let token1;
    if (token1RO) {
        token1 = { ...token1RO };
    } else {
        token1 = {
            id: token1Id,
            symbol: meta1!.symbol,
            name: meta1!.name,
            decimals: BigInt(meta1!.decimals),
            isWhitelisted: isAddressInList(token1Address, cfg.whitelistTokens),
            volume: ZERO_BD,
            volumeUSD: ZERO_BD,
            untrackedVolumeUSD: ZERO_BD,
            feesUSD: ZERO_BI as any, // This was error in previous code if any, let's use ZERO_BD
            txCount: ZERO_BI,
            poolCount: ZERO_BI,
            totalValueLocked: ZERO_BD,
            totalValueLockedUSD: ZERO_BD,
            totalValueLockedUSDUntracked: ZERO_BD,
            derivedETH: ZERO_BD,
            whitelistPools: [] as string[],
        };
        // Just correcting the type mismatch during copy-paste
        token1.feesUSD = ZERO_BD;
    }

    // ── Pool ─────────────────────────────────────────────────────────────────
    const poolId = `${chainId}-${poolAddress.toLowerCase()}`;
    const pool = {
        id: poolId,
        dex: dexName,
        createdAtTimestamp: BigInt(event.block.timestamp),
        createdAtBlockNumber: BigInt(event.block.number),
        token0_id: token0Id,
        token1_id: token1Id,
        feeTier: BigInt(fee),
        liquidity: ZERO_BI,
        sqrtPrice: ZERO_BI,
        token0Price: ZERO_BD,
        token1Price: ZERO_BD,
        tick: undefined as bigint | undefined,
        observationIndex: ZERO_BI,
        volumeToken0: ZERO_BD,
        volumeToken1: ZERO_BD,
        volumeUSD: ZERO_BD,
        untrackedVolumeUSD: ZERO_BD,
        feesUSD: ZERO_BD,
        txCount: ZERO_BI,
        collectedFeesToken0: ZERO_BD,
        collectedFeesToken1: ZERO_BD,
        collectedFeesUSD: ZERO_BD,
        totalValueLockedToken0: ZERO_BD,
        totalValueLockedToken1: ZERO_BD,
        totalValueLockedETH: ZERO_BD,
        totalValueLockedUSD: ZERO_BD,
        totalValueLockedUSDUntracked: ZERO_BD,
        liquidityProviderCount: ZERO_BI,
    };

    // ── Whitelist pool tracking ───────────────────────────────────────────────
    if (token0.isWhitelisted && !token1.whitelistPools.includes(poolId)) {
        token1.whitelistPools = [...token1.whitelistPools, poolId];
    }
    if (token1.isWhitelisted && !token0.whitelistPools.includes(poolId)) {
        token0.whitelistPools = [...token0.whitelistPools, poolId];
    }

    // bump pool count on tokens
    token0.poolCount = token0.poolCount + ONE_BI;
    token1.poolCount = token1.poolCount + ONE_BI;

    context.Pool.set(pool);
    context.Token.set(token0);
    context.Token.set(token1);
};

// ─────────────────────────────────────────────────────────────────────────────
// Registrations
// ─────────────────────────────────────────────────────────────────────────────
UniswapV3Factory.PoolCreated.contractRegister(({ event, context }) => {
    context.addUniswapV3Pool(event.params.pool);
});
UniswapV3Factory.PoolCreated.handler((args) => handlePoolCreated(args, "UniswapV3"));

SolidlyV3Factory.PoolCreated.contractRegister(({ event, context }) => {
    context.addSolidlyV3Pool(event.params.pool);
});
SolidlyV3Factory.PoolCreated.handler((args) => handlePoolCreated(args, "SolidlyV3"));

SushiV3Factory.PoolCreated.contractRegister(({ event, context }) => {
    context.addSushiV3Pool(event.params.pool);
});
SushiV3Factory.PoolCreated.handler((args) => handlePoolCreated(args, "SushiV3"));
