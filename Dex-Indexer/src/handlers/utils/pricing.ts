import { Bundle, Token, BigDecimal, handlerContext } from "generated";
import { ADDRESS_ZERO, ONE_BD, ZERO_BD, ZERO_BI } from "./constants";
import { exponentToBigDecimal, safeDiv, isAddressInList } from "./index";
import { NativeTokenDetails } from "./chains";

const Q192 = BigInt(2) ** BigInt(192);

// ─────────────────────────────────────────────────────────────────────────────
// sqrtPriceX96 → [token0Price, token1Price]
// ─────────────────────────────────────────────────────────────────────────────
export function sqrtPriceX96ToTokenPrices(
    sqrtPriceX96: bigint,
    token0: Token,
    token1: Token,
    nativeTokenDetails: NativeTokenDetails
): BigDecimal[] {
    const t0Dec = token0.id.split("-")[1] === ADDRESS_ZERO
        ? nativeTokenDetails.decimals : token0.decimals;
    const t1Dec = token1.id.split("-")[1] === ADDRESS_ZERO
        ? nativeTokenDetails.decimals : token1.decimals;

    const num   = new BigDecimal((sqrtPriceX96 * sqrtPriceX96).toString());
    const denom = new BigDecimal(Q192.toString());

    // price1 = token0/token1 adjusted for decimals
    const price1 = exponentToBigDecimal(t0Dec)
        .times(num)
        .div(exponentToBigDecimal(t1Dec).times(denom))
        .dp(18);

    const price0 = safeDiv(ONE_BD, price1);
    return [price0, price1];
}

// ─────────────────────────────────────────────────────────────────────────────
// Native token price in USD — reads from the stablecoin/WETH reference pool
// The reference pool is always a UniswapV3 pool (most liquid, most reliable).
// ─────────────────────────────────────────────────────────────────────────────
export async function getNativePriceInUSD(
    context: handlerContext,
    chainId: number,
    stablecoinWrappedNativePoolId: string,
    stablecoinIsToken0: boolean
): Promise<BigDecimal> {
    const poolId = `${chainId}-${stablecoinWrappedNativePoolId}`;
    const pool   = await context.Pool.get(poolId);
    if (!pool) return ZERO_BD;
    return stablecoinIsToken0 ? pool.token0Price : pool.token1Price;
}

// ─────────────────────────────────────────────────────────────────────────────
// Walk token's whitelistPools to find the best ETH-denominated price
// ─────────────────────────────────────────────────────────────────────────────
export async function findNativePerToken(
    context: handlerContext,
    token: Token,
    bundle: Bundle,
    wrappedNativeAddress: string,
    stablecoinAddresses: string[],
    minimumNativeLocked: BigDecimal
): Promise<BigDecimal> {
    const tokenAddress = token.id.split("-")[1];

    // Native or wrapped native → price is 1
    if (
        tokenAddress === wrappedNativeAddress.toLowerCase() ||
        tokenAddress === ADDRESS_ZERO
    ) {
        return ONE_BD;
    }

    // Stablecoin → price is 1/ethPriceUSD
    if (isAddressInList(tokenAddress, stablecoinAddresses)) {
        return safeDiv(ONE_BD, bundle.ethPriceUSD);
    }

    // Walk whitelist pools to find largest ETH-locked pool
    const pools = await Promise.all(
        token.whitelistPools.map(id => context.Pool.get(id))
    );

    let largestETH = ZERO_BD;
    let priceSoFar = ZERO_BD;

    for (const pool of pools) {
        if (!pool || pool.liquidity <= ZERO_BI) continue;

        if (pool.token0_id === token.id) {
            const t1 = await context.Token.get(pool.token1_id);
            if (t1) {
                const ethLocked = pool.totalValueLockedToken1.times(t1.derivedETH);
                if (ethLocked.gt(largestETH) && ethLocked.gt(minimumNativeLocked)) {
                    largestETH = ethLocked;
                    priceSoFar = pool.token1Price.times(t1.derivedETH);
                }
            }
        } else if (pool.token1_id === token.id) {
            const t0 = await context.Token.get(pool.token0_id);
            if (t0) {
                const ethLocked = pool.totalValueLockedToken0.times(t0.derivedETH);
                if (ethLocked.gt(largestETH) && ethLocked.gt(minimumNativeLocked)) {
                    largestETH = ethLocked;
                    priceSoFar = pool.token0Price.times(t0.derivedETH);
                }
            }
        }
    }

    return priceSoFar;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tracked USD amount — only count if at least one side is whitelisted.
// Divide by 2 to avoid counting both sides of the swap as volume.
// ─────────────────────────────────────────────────────────────────────────────
export function getTrackedAmountUSD(
    bundle: Bundle,
    amount0: BigDecimal,
    token0: Token,
    amount1: BigDecimal,
    token1: Token,
    whitelistTokens: string[]
): BigDecimal {
    if (!bundle) return ZERO_BD;

    const price0 = token0.derivedETH.times(bundle.ethPriceUSD);
    const price1 = token1.derivedETH.times(bundle.ethPriceUSD);

    const addr0 = token0.id.split("-")[1];
    const addr1 = token1.id.split("-")[1];

    const w0 = isAddressInList(addr0, whitelistTokens);
    const w1 = isAddressInList(addr1, whitelistTokens);

    if (w0 && w1) {
        return amount0.times(price0).plus(amount1.times(price1));
    }
    if (w0 && !w1) {
        return amount0.times(price0).times(new BigDecimal("2"));
    }
    if (!w0 && w1) {
        return amount1.times(price1).times(new BigDecimal("2"));
    }
    return ZERO_BD;
}
