import { UniswapV3Factory } from "generated";
import { ZERO_BD, ZERO_BI, ONE_BI } from "./utils/constants";
import { CHAIN_CONFIGS } from "./utils/chains";
import { isAddressInList } from "./utils/index";

// ─────────────────────────────────────────────────────────────────────────────
// Uniswap V3 Factory — creates Pool, Token entities placeholder
// ─────────────────────────────────────────────────────────────────────────────
const handlePoolCreated = async (
    { event, context }: any,
    dexName: string
) => {
    console.log(`[Factory] Handling PoolCreated for ${dexName} on chain ${event.chainId} at block ${event.block.number}`);
    const chainId = event.chainId;
    const cfg = CHAIN_CONFIGS[chainId];
    if (!cfg) return;

    const { token0: token0Address, token1: token1Address, fee, pool: poolAddress } = event.params;

    if (!token0Address || !token1Address || !poolAddress) {
        console.error(`[Factory] Missing required parameters in ${dexName} event:`, event.params);
        return;
    }

    const feeValue = fee !== undefined ? fee : 0;

    if (isAddressInList(poolAddress, cfg.poolsToSkip)) return;

    // 1. Resolve initial metadata (from overrides or placeholders)
    const getInitialMeta = (address: string) => {
        const override = cfg.tokenOverrides.find(o => o.address.toLowerCase() === address.toLowerCase());
        if (override) {
            return { ...override, isMetadataFetched: true };
        }
        // Fallback for native token
        if (address.toLowerCase() === "0x0000000000000000000000000000000000000000") {
            return {
                symbol: cfg.nativeTokenDetails.symbol,
                name: cfg.nativeTokenDetails.name,
                decimals: cfg.nativeTokenDetails.decimals,
                isMetadataFetched: true
            };
        }
        return {
            symbol: '?',
            name: 'Unknown Token',
            decimals: 18n,
            isMetadataFetched: false
        };
    };

    const token0Id = `${chainId}-${token0Address.toLowerCase()}`;
    const token1Id = `${chainId}-${token1Address.toLowerCase()}`;

    const [token0RO, token1RO] = await Promise.all([
        context.Token.get(token0Id),
        context.Token.get(token1Id),
    ]);

    // One Bundle per chain (shared across DEXes)
    const bundleExists = await context.Bundle.get(chainId.toString());
    if (!bundleExists) {
        context.Bundle.set({
            id: chainId.toString(),
            ethPriceUSD: ZERO_BD
        });
    }

    // ── Token 0 ──────────────────────────────────────────────────────────────
    let token0;
    if (token0RO) {
        token0 = { ...token0RO };
    } else {
        const meta = getInitialMeta(token0Address);
        token0 = {
            id: token0Id,
            symbol: meta.symbol,
            name: meta.name,
            decimals: meta.decimals,
            isMetadataFetched: meta.isMetadataFetched,
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
    let token1;
    if (token1RO) {
        token1 = { ...token1RO };
    } else {
        const meta = getInitialMeta(token1Address);
        token1 = {
            id: token1Id,
            symbol: meta.symbol,
            name: meta.name,
            decimals: meta.decimals,
            isMetadataFetched: meta.isMetadataFetched,
            isWhitelisted: isAddressInList(token1Address, cfg.whitelistTokens),
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

    // ── Pool ─────────────────────────────────────────────────────────────────
    const poolId = `${chainId}-${poolAddress.toLowerCase()}`;
    const pool = {
        id: poolId,
        dex: dexName,
        createdAtTimestamp: BigInt(event.block.timestamp),
        createdAtBlockNumber: BigInt(event.block.number),
        token0_id: token0Id,
        token1_id: token1Id,
        feeTier: BigInt(feeValue),
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
    console.log(`[UniswapV3] contractRegister called for pool ${event.params.pool}`);
    context.addUniswapV3Pool(event.params.pool);
});
UniswapV3Factory.PoolCreated.handler((args) => handlePoolCreated(args, "UniswapV3"));
