import {
    UniswapV3Pool,
    BigDecimal,
    Swap,
} from "generated";
import { CHAIN_CONFIGS } from "./utils/chains";
import { ONE_BI, ZERO_BI, ZERO_BD } from "./utils/constants";
import { convertTokenToDecimal, loadTransaction } from "./utils/index";
import {
    sqrtPriceX96ToTokenPrices,
    getNativePriceInUSD,
    findNativePerToken,
    getTrackedAmountUSD,
} from "./utils/pricing";
import { getTokensMetadataEffect, getPoolMetadataEffect } from "./utils/getTokensMetadataEffect";

// ─────────────────────────────────────────────────────────────────────────────
// Pool Registry (Bootstrapped from Dune)
// ─────────────────────────────────────────────────────────────────────────────
let poolReg: Record<string, any> = {};
try {
    poolReg = require("./utils/poolReg.json");
} catch (e) {
    console.warn("[Pool] No pre-loaded pool registry found. Falling back to RPC discovery.");
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared state helpers
// ─────────────────────────────────────────────────────────────────────────────

const getOrCreatePoolAndTokens = async (context: any, chainId: number, poolAddress: string) => {
    const poolId = `${chainId}-${poolAddress.toLowerCase()}`;
    let poolEntity: any = await context.Pool.get(poolId);

    // If pool is missing (Cold Start for static addresses), check registry then RPC
    if (!poolEntity) {
        const regEntry = poolReg[poolId];
        let meta: any;

        if (regEntry) {
            // Instant discovery from Dune data!
            meta = {
                token0: regEntry.t0,
                token1: regEntry.t1,
                fee: regEntry.fee,
                reg: regEntry // keep for token metadata
            };
        } else {
            // Fallback to RPC discovery
            meta = await context.effect(getPoolMetadataEffect, {
                poolAddress,
                chainId,
            });
        }

        const t0_id = `${chainId}-${meta.token0.toLowerCase()}`;
        const t1_id = `${chainId}-${meta.token1.toLowerCase()}`;

        // Ensure Bundle exists
        let bundle_pre = await context.Bundle.get(chainId.toString());
        if (!bundle_pre) {
            context.Bundle.set({ id: chainId.toString(), ethPriceUSD: ZERO_BD });
        }

        // Create Token entities helper
        const createTkn = (id: string, symbol = "...", name = "...", decimals = 18n, fetched = false) => ({
            id, symbol, name, decimals,
            isMetadataFetched: fetched,
            isWhitelisted: false,
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
        });

        let t0_ent = await context.Token.get(t0_id);
        if (!t0_ent) {
            const sym = meta.reg?.t0Meta?.symbol || "...";
            const dec = meta.reg?.t0Meta?.decimals ? BigInt(meta.reg.t0Meta.decimals) : 18n;
            context.Token.set(createTkn(t0_id, sym, sym, dec, !!meta.reg));
        }

        let t1_ent = await context.Token.get(t1_id);
        if (!t1_ent) {
            const sym = meta.reg?.t1Meta?.symbol || "...";
            const dec = meta.reg?.t1Meta?.decimals ? BigInt(meta.reg.t1Meta.decimals) : 18n;
            context.Token.set(createTkn(t1_id, sym, sym, dec, !!meta.reg));
        }

        poolEntity = {
            id: poolId,
            dex: "UniswapV3",
            token0_id: t0_id,
            token1_id: t1_id,
            feeTier: BigInt(meta.fee),
            sqrtPrice: ZERO_BI,
            liquidity: ZERO_BI,
            tick: ZERO_BI,
            observationIndex: ZERO_BI,
            token0Price: ZERO_BD,
            token1Price: ZERO_BD,
            volumeToken0: ZERO_BD,
            volumeToken1: ZERO_BD,
            volumeUSD: ZERO_BD,
            untrackedVolumeUSD: ZERO_BD,
            feesUSD: ZERO_BD,
            collectedFeesToken0: ZERO_BD,
            collectedFeesToken1: ZERO_BD,
            collectedFeesUSD: ZERO_BD,
            txCount: ZERO_BI,
            totalValueLockedToken0: ZERO_BD,
            totalValueLockedToken1: ZERO_BD,
            totalValueLockedETH: ZERO_BD,
            totalValueLockedUSD: ZERO_BD,
            totalValueLockedUSDUntracked: ZERO_BD,
            liquidityProviderCount: ZERO_BI,
            createdAtTimestamp: ZERO_BI,
            createdAtBlockNumber: ZERO_BI,
        };
        context.Pool.set(poolEntity);
    }

    let [b_ro, t0_ro, t1_ro]: any[] = await Promise.all([
        context.Bundle.get(chainId.toString()),
        context.Token.get(poolEntity.token0_id),
        context.Token.get(poolEntity.token1_id),
    ]);

    if (!b_ro || !t0_ro || !t1_ro) return null;

    let t0_final = { ...t0_ro };
    let t1_final = { ...t1_ro };

    // Dynamically fetch metadata IF still missing (not in Dune or registry)
    if (!t0_final.isMetadataFetched || !t1_final.isMetadataFetched) {
        const results: any = await context.effect(getTokensMetadataEffect, {
            token0: t0_final.id.split('-')[1],
            token1: t1_final.id.split('-')[1],
            chainId,
        });

        if (!t0_final.isMetadataFetched && results.meta0) {
            t0_final.symbol = results.meta0.symbol;
            t0_final.name = results.meta0.name;
            t0_final.decimals = BigInt(results.meta0.decimals);
            t0_final.isMetadataFetched = true;
            context.Token.set(t0_final);
        }
        if (!t1_final.isMetadataFetched && results.meta1) {
            t1_final.symbol = results.meta1.symbol;
            t1_final.name = results.meta1.name;
            t1_final.decimals = BigInt(results.meta1.decimals);
            t1_final.isMetadataFetched = true;
            context.Token.set(t1_final);
        }
    }

    return {
        bundle: { ...b_ro },
        token0: t0_final,
        token1: t1_final,
        pool: { ...poolEntity }
    };
};

const updatePricesAndBundle = async (context: any, chainId: number, bundle: any, cfg: any) => {
    const newEthPriceUSD = await getNativePriceInUSD(
        context, chainId,
        cfg.stablecoinWrappedNativePoolId,
        cfg.stablecoinIsToken0
    );

    if (newEthPriceUSD.gt(ZERO_BD)) {
        bundle.ethPriceUSD = newEthPriceUSD;
    }
    context.Bundle.set(bundle);
};

// ─────────────────────────────────────────────────────────────────────────────
// Core Handlers
// ─────────────────────────────────────────────────────────────────────────────

const handleInitialize = async ({ event, context }: any) => {
    const chainId = event.chainId;
    const cfg = CHAIN_CONFIGS[chainId];
    if (!cfg) return;

    const entities: any = await getOrCreatePoolAndTokens(context, chainId, event.srcAddress);
    if (!entities) return;

    const { bundle, token0, token1, pool } = entities;

    const prices = sqrtPriceX96ToTokenPrices(
        event.params.sqrtPriceX96, token0, token1, cfg.nativeTokenDetails
    );

    pool.sqrtPrice = event.params.sqrtPriceX96;
    pool.tick = event.params.tick;
    pool.token0Price = prices[0];
    pool.token1Price = prices[1];
    pool.createdAtTimestamp = event.block.timestamp;
    pool.createdAtBlockNumber = event.block.number;

    context.Pool.set(pool);

    await updatePricesAndBundle(context, chainId, bundle, cfg);

    [token0.derivedETH, token1.derivedETH] = await Promise.all([
        findNativePerToken(context, token0, bundle, cfg.wrappedNativeAddress, cfg.stablecoinAddresses, cfg.minimumNativeLocked),
        findNativePerToken(context, token1, bundle, cfg.wrappedNativeAddress, cfg.stablecoinAddresses, cfg.minimumNativeLocked),
    ]);

    context.Token.set(token0);
    context.Token.set(token1);
};

const handleSwap = async ({ event, context }: any, dexName: string) => {
    const chainId = event.chainId;
    const cfg = CHAIN_CONFIGS[chainId];
    if (!cfg) return;

    if (cfg.poolsToSkip.includes(event.srcAddress.toLowerCase())) return;

    const entities: any = await getOrCreatePoolAndTokens(context, chainId, event.srcAddress);
    if (!entities) return;

    const { bundle, token0, token1, pool } = entities;

    if (event.srcAddress.toLowerCase() === cfg.stablecoinWrappedNativePoolId.toLowerCase()) {
        const pricesRes = sqrtPriceX96ToTokenPrices(
            event.params.sqrtPriceX96,
            token0,
            token1,
            cfg.nativeTokenDetails
        );
        bundle.ethPriceUSD = cfg.stablecoinIsToken0 ? pricesRes[0] : pricesRes[1];
    }
    const ts = event.block.timestamp;

    const amount0 = convertTokenToDecimal(event.params.amount0, token0.decimals);
    const amount1 = convertTokenToDecimal(event.params.amount1, token1.decimals);

    const amount0Abs = amount0.lt(ZERO_BD) ? amount0.times(new BigDecimal("-1")) : amount0;
    const amount1Abs = amount1.lt(ZERO_BD) ? amount1.times(new BigDecimal("-1")) : amount1;

    pool.volumeToken0 = pool.volumeToken0.plus(amount0Abs);
    pool.volumeToken1 = pool.volumeToken1.plus(amount1Abs);
    pool.txCount = pool.txCount + ONE_BI;

    pool.liquidity = event.params.liquidity;
    pool.tick = event.params.tick;
    pool.sqrtPrice = event.params.sqrtPriceX96;

    pool.totalValueLockedToken0 = pool.totalValueLockedToken0.plus(amount0);
    pool.totalValueLockedToken1 = pool.totalValueLockedToken1.plus(amount1);

    token0.volume = token0.volume.plus(amount0Abs);
    token0.totalValueLocked = token0.totalValueLocked.plus(amount0);
    token0.txCount = token0.txCount + ONE_BI;

    token1.volume = token1.volume.plus(amount1Abs);
    token1.totalValueLocked = token1.totalValueLocked.plus(amount1);
    token1.txCount = token1.txCount + ONE_BI;

    const prices = sqrtPriceX96ToTokenPrices(
        pool.sqrtPrice, token0, token1, cfg.nativeTokenDetails
    );
    pool.token0Price = prices[0];
    pool.token1Price = prices[1];

    context.Pool.set(pool);

    await updatePricesAndBundle(context, chainId, bundle, cfg);

    [token0.derivedETH, token1.derivedETH] = await Promise.all([
        findNativePerToken(context, token0, bundle, cfg.wrappedNativeAddress, cfg.stablecoinAddresses, cfg.minimumNativeLocked),
        findNativePerToken(context, token1, bundle, cfg.wrappedNativeAddress, cfg.stablecoinAddresses, cfg.minimumNativeLocked),
    ]);

    const amount0ETH = amount0Abs.times(token0.derivedETH);
    const amount1ETH = amount1Abs.times(token1.derivedETH);
    const amount0USD = amount0ETH.times(bundle.ethPriceUSD);
    const amount1USD = amount1ETH.times(bundle.ethPriceUSD);

    const amountUSDTracked = getTrackedAmountUSD(
        bundle, amount0Abs, token0, amount1Abs, token1, cfg.whitelistTokens
    ).div(new BigDecimal("2"));

    const amountUSDUntracked = amount0USD.plus(amount1USD).div(new BigDecimal("2"));
    const amountUSDFinal = amountUSDTracked.gt(ZERO_BD) ? amountUSDTracked : amountUSDUntracked;

    pool.totalValueLockedETH =
        pool.totalValueLockedToken0.times(token0.derivedETH)
            .plus(pool.totalValueLockedToken1.times(token1.derivedETH));
    pool.totalValueLockedUSD = pool.totalValueLockedETH.times(bundle.ethPriceUSD);

    token0.totalValueLockedUSD =
        token1.totalValueLocked.times(token1.derivedETH).times(bundle.ethPriceUSD);
    token1.totalValueLockedUSD =
        token1.totalValueLocked.times(token1.derivedETH).times(bundle.ethPriceUSD);

    pool.volumeUSD = pool.volumeUSD.plus(amountUSDTracked);
    pool.untrackedVolumeUSD = pool.untrackedVolumeUSD.plus(amountUSDUntracked);

    token0.volumeUSD = token0.volumeUSD.plus(amountUSDTracked);
    token0.untrackedVolumeUSD = token0.untrackedVolumeUSD.plus(amountUSDUntracked);

    token1.volumeUSD = token1.volumeUSD.plus(amountUSDTracked);
    token1.untrackedVolumeUSD = token1.untrackedVolumeUSD.plus(amountUSDUntracked);

    const tx = await loadTransaction(
        event.transaction.hash,
        event.block.number,
        ts,
        event.transaction.gasPrice || ZERO_BI,
        event.transaction.from || "",
        event.transaction.to || "",
        context
    );

    const swap: Swap = {
        id: `${tx.id.toLowerCase()}-${event.logIndex}`,
        dex: dexName,
        transaction_id: tx.id,
        timestamp: BigInt(ts),
        pool_id: pool.id,
        token0_id: pool.token0_id,
        token1_id: pool.token1_id,
        sender: event.params.sender,
        recipient: event.params.recipient,
        origin: event.transaction.from?.toLowerCase() || '',
        txFrom: event.transaction.from || "",
        txTo: event.transaction.to || "",
        amount0,
        amount1,
        amountUSD: amountUSDFinal,
        sqrtPriceX96: event.params.sqrtPriceX96,
        tick: event.params.tick,
        logIndex: BigInt(event.logIndex),
        gasPrice: event.transaction.gasPrice,
        gasUsed: ZERO_BI,
    };

    context.Swap.set(swap);
    context.Pool.set(pool);
    context.Token.set(token0);
    context.Token.set(token1);
};

// ─────────────────────────────────────────────────────────────────────────────
// Register handlers
// ─────────────────────────────────────────────────────────────────────────────

UniswapV3Pool.Initialize.handler((args) => handleInitialize(args));
UniswapV3Pool.Swap.handler((args) => handleSwap(args, "UniswapV3"));
