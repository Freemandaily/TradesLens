import {
    UniswapV3Pool,
    SolidlyV3Pool,
    SushiV3Pool,
    BigDecimal,
    Swap,
} from "generated";
import { CHAIN_CONFIGS } from "./utils/chains";
import { ONE_BI, ZERO_BI, ZERO_BD } from "./utils/constants";
import { convertTokenToDecimal, loadTransaction, safeDiv } from "./utils/index";
import {
    sqrtPriceX96ToTokenPrices,
    getNativePriceInUSD,
    findNativePerToken,
    getTrackedAmountUSD,
} from "./utils/pricing";

// ─────────────────────────────────────────────────────────────────────────────
// Shared state helpers
// ─────────────────────────────────────────────────────────────────────────────

const getBaseEntities = async (context: any, chainId: number, poolRO: any) => {
    const [bundleRO, token0RO, token1RO] = await Promise.all([
        context.Bundle.get(chainId.toString()),
        context.Token.get(poolRO.token0_id),
        context.Token.get(poolRO.token1_id),
    ]);

    if (!bundleRO || !token0RO || !token1RO) {
        return null;
    }

    return {
        bundle: { ...bundleRO },
        token0: { ...token0RO },
        token1: { ...token1RO },
        pool: { ...poolRO }
    };
};

const updatePricesAndBundle = async (context: any, chainId: number, event: any, bundle: any, cfg: any) => {
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

/**
 * Initialize handler — sets the starting price/tick for the pool
 */
const handleInitialize = async ({ event, context }: any) => {
    const chainId = event.chainId;
    const cfg = CHAIN_CONFIGS[chainId];
    if (!cfg) return;

    const poolId = `${chainId}-${event.srcAddress.toLowerCase()}`;
    const poolRO = await context.Pool.get(poolId);
    if (!poolRO) return;

    const entities = await getBaseEntities(context, chainId, poolRO);
    if (!entities) return;

    const { bundle, token0, token1, pool } = entities;

    const prices = sqrtPriceX96ToTokenPrices(
        event.params.sqrtPriceX96, token0, token1, cfg.nativeTokenDetails
    );

    pool.sqrtPrice = event.params.sqrtPriceX96;
    pool.tick = event.params.tick;
    pool.token0Price = prices[0];
    pool.token1Price = prices[1];

    context.Pool.set(pool);

    await updatePricesAndBundle(context, chainId, event, bundle, cfg);

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

    const poolId = `${chainId}-${event.srcAddress.toLowerCase()}`;
    const poolRO = await context.Pool.get(poolId);

    // ── BOOTSTRAP STRATEGY ──────────────────────────────────────────────────
    if (!poolRO) {
        if (event.srcAddress.toLowerCase() === cfg.stablecoinWrappedNativePoolId.toLowerCase()) {
            const bundleRO = await context.Bundle.get(chainId.toString());
            const bundleTemp = bundleRO ? { ...bundleRO } : { id: chainId.toString(), ethPriceUSD: ZERO_BD };

            const t0Decimals = cfg.stablecoinIsToken0 ? cfg.stablecoinDecimals : 18n; // Typically stablecoin (6 or 18) and WETH(18)
            const t1Decimals = cfg.stablecoinIsToken0 ? 18n : cfg.stablecoinDecimals;
            const pricesRS = sqrtPriceX96ToTokenPrices(
                event.params.sqrtPriceX96,
                { id: "0-bootstrap-0", decimals: t0Decimals } as any,
                { id: "0-bootstrap-1", decimals: t1Decimals } as any,
                cfg.nativeTokenDetails
            );
            bundleTemp.ethPriceUSD = cfg.stablecoinIsToken0 ? pricesRS[0] : pricesRS[1];
            context.Bundle.set(bundleTemp);
        }
        return;
    }

    if (cfg.poolsToSkip.includes(event.srcAddress.toLowerCase())) return;

    const entities = await getBaseEntities(context, chainId, poolRO);
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

    await updatePricesAndBundle(context, chainId, event, bundle, cfg);

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
        token0.totalValueLocked.times(token0.derivedETH).times(bundle.ethPriceUSD);
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

// UniswapV3
UniswapV3Pool.Initialize.handler((args) => handleInitialize(args));
UniswapV3Pool.Swap.handler((args) => handleSwap(args, "UniswapV3"));

// SolidlyV3
SolidlyV3Pool.Initialize.handler((args) => handleInitialize(args));
SolidlyV3Pool.Swap.handler((args) => handleSwap(args, "SolidlyV3"));

// SushiV3
SushiV3Pool.Initialize.handler((args) => handleInitialize(args));
SushiV3Pool.Swap.handler((args) => handleSwap(args, "SushiV3"));
