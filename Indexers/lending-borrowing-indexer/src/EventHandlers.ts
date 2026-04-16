import {
    AaveV3Pool,
    ChainlinkAggregator,
    Supply,
    Borrow,
    Repay,
    Liquidation,
    Price,
    Token,
    TokenMetadata,
} from "generated";
import { createEffect, S } from "envio";
import BigNumber from "bignumber.js";
import { createPublicClient, http, erc20Abi, parseAbi } from "viem";
import { mainnet, optimism } from "viem/chains";

// Chain Configuration Mapping
const CHAIN_CONFIGS: Record<number, { oracle: `0x${string}`; chain: any; rpc: string }> = {
    1: {
        oracle: "0x54586bE62E3c3580375aE3723C145253060Ca0C2",
        chain: mainnet,
        rpc: "https://ethereum-rpc.publicnode.com"
    },
    10: {
        oracle: "0xD81eb3728a631871a7eBBaD631b5f424909f0c77",
        chain: optimism,
        rpc: "https://mainnet.optimism.io" // SWITCHED TO OFFICIAL NODE FOR RELIABILITY
    }
};

const AAVE_ORACLE_ABI = parseAbi([
    "function getSourceOfAsset(address asset) external view returns (address)",
    "function getAssetPrice(address asset) external view returns (uint256)",
]);

// Calculation helper
function calculateUSDAmount(amount: bigint, price: BigNumber, decimals: number): BigNumber {
    const normalizedAmount = new BigNumber(amount.toString()).div(new BigNumber(10).pow(decimals));
    const result = normalizedAmount.times(price);
    return result.isNaN() || !result.isFinite() ? new BigNumber(0) : result;
}

// Effect for Dynamic Token Discovery
const discoveryEffect = createEffect(
    {
        name: "tokenDiscovery",
        input: S.object((s) => ({
            tokenAddress: s.field("tokenAddress", S.string),
            blockNumber: s.field("blockNumber", S.int32),
            chainId: s.field("chainId", S.int32),
        })),
        output: S.object((s) => ({
            name: s.field("name", S.string),
            symbol: s.field("symbol", S.string),
            decimals: s.field("decimals", S.int32),
            source: s.field("source", S.string),
            price: s.field("price", S.bigint),
        })),
        rateLimit: false,
    },
    async ({ input: unknownInput }) => {
        const input = unknownInput as { tokenAddress: `0x${string}`; blockNumber: number; chainId: number };
        const config = CHAIN_CONFIGS[input.chainId];

        if (!config) throw new Error(`Unsupported chainId: ${input.chainId}`);

        const client = createPublicClient({
            chain: config.chain,
            transport: http(config.rpc),
        });

        try {
            const results = await client.multicall({
                contracts: [
                    { address: input.tokenAddress, abi: erc20Abi, functionName: "name" },
                    { address: input.tokenAddress, abi: erc20Abi, functionName: "symbol" },
                    { address: input.tokenAddress, abi: erc20Abi, functionName: "decimals" },
                    { address: config.oracle, abi: AAVE_ORACLE_ABI, functionName: "getSourceOfAsset", args: [input.tokenAddress] },
                    { address: config.oracle, abi: AAVE_ORACLE_ABI, functionName: "getAssetPrice", args: [input.tokenAddress] },
                ],
                blockNumber: BigInt(input.blockNumber),
            });

            // If critical calls failed, throw instead of returning bad data
            if (results[0].status === 'failure' || results[1].status === 'failure' || results[4].status === 'failure') {
                throw new Error(`Critical metadata call failed for ${input.tokenAddress}`);
            }

            const name = results[0].result as string;
            const symbol = results[1].result as string;
            const decimals = results[2].status === 'success' ? results[2].result : 18;
            const source = (results[3]?.status === 'success' ? results[3].result : "0x0000000000000000000000000000000000000000") as string;
            const price = results[4].result as bigint;

            return {
                name: name,
                symbol: symbol,
                decimals: Number(decimals),
                source: source.toLowerCase(),
                price: price,
            };
        } catch (error) {
            console.error(`[EFFECT] discoveryEffect FAILED on chain ${input.chainId}:`, error);
            throw error; // Let Envio retry rather than saving "Unknown"
        }
    }
);

// Local memory cache
const tokenCache = new Map<string, CachedToken>();

interface CachedToken {
    name: string;
    symbol: string;
    decimals: number;
    source: string;
    lastPrice: BigNumber;
}

async function ensureToken(tokenAddress: string, event: any, context: any) {
    const tAddr = tokenAddress.toLowerCase();
    const chainId = event.chainId;
    const compositeId = `${chainId}-${tAddr}`;

    // 1. Instant Memory check
    const cached = tokenCache.get(compositeId);
    if (cached) {
        return {
            decimals: cached.decimals,
            price: cached.lastPrice,
            name: cached.name,
            symbol: cached.symbol
        };
    }

    // 2. Database check
    const [existingToken, existingPrice] = await Promise.all([
        context.Token.get(compositeId),
        context.Price.get(compositeId)
    ]);

    if (existingToken && existingPrice && existingToken.name !== "Unknown") {
        const tokenInfo = {
            name: existingToken.name,
            symbol: existingToken.symbol,
            decimals: existingToken.decimals,
            source: existingToken.source,
            lastPrice: existingPrice.price
        };
        tokenCache.set(compositeId, tokenInfo);
        return {
            decimals: existingToken.decimals,
            price: existingPrice.price,
            name: existingToken.name,
            symbol: existingToken.symbol
        };
    }

    // 3. DISCOVERY
    // console.log(`[DEBUG] Syncing ${tAddr} on Chain ${chainId} (Block: ${event.block.number})`);
    let discovery;
    try {
        discovery = await context.effect(discoveryEffect, {
            tokenAddress: tAddr,
            blockNumber: event.block.number,
            chainId: chainId
        });
    } catch (e) {
        // If discovery throws, the whole event will retry.
        throw e;
    }

    const normalizedPrice = new BigNumber(discovery.price.toString()).div(1e8);

    // 4. UPSERT: Save to DB with Composite ID
    context.Token.set({
        id: compositeId,
        name: discovery.name,
        symbol: discovery.symbol,
        decimals: discovery.decimals,
        source: discovery.source.toLowerCase(),
    });

    context.TokenMetadata.set({
        id: `${chainId}-${discovery.source.toLowerCase()}`,
        tokenAddress: tAddr,
        name: discovery.name,
        symbol: discovery.symbol,
        decimals: discovery.decimals,
    });

    context.Price.set({
        id: compositeId,
        price: normalizedPrice,
        timestamp: event.block.timestamp,
        chainId: chainId,
    });

    // 5. Update Memory Cache
    const tokenInfo = {
        name: discovery.name,
        symbol: discovery.symbol,
        decimals: discovery.decimals,
        source: discovery.source.toLowerCase(),
        lastPrice: normalizedPrice
    };
    tokenCache.set(compositeId, tokenInfo);

    return { decimals: discovery.decimals, price: normalizedPrice, name: discovery.name, symbol: discovery.symbol };
}

ChainlinkAggregator.AnswerUpdated.handler(async ({ event, context }) => {
    const metadata = await context.TokenMetadata.get(`${event.chainId}-${event.srcAddress.toLowerCase()}`);
    if (!metadata) return;

    const tAddr = metadata.tokenAddress.toLowerCase();
    const compositeId = `${event.chainId}-${tAddr}`;
    const newPrice = new BigNumber(event.params.current.toString()).div(1e8);

    context.Price.set({
        id: compositeId,
        price: newPrice,
        timestamp: event.block.timestamp,
        chainId: event.chainId,
    });

    const cached = tokenCache.get(compositeId);
    if (cached) {
        cached.lastPrice = newPrice;
    }
});

AaveV3Pool.Supply.handler(async ({ event, context }) => {
    const asset = await ensureToken(event.params.reserve, event, context);

    const entity: Supply = {
        id: `${event.transaction.hash}_${event.logIndex}`,
        contractAddress: event.srcAddress,
        reserve: event.params.reserve,
        reserveName: asset.name,
        reserveSymbol: asset.symbol,
        user: event.params.user,
        onBehalfOf: event.params.onBehalfOf,
        amount: event.params.amount,
        amountUSD: calculateUSDAmount(event.params.amount, asset.price, asset.decimals),
        reserveDecimals: asset.decimals,
        referralCode: Number(event.params.referralCode),
        timestamp: event.block.timestamp,
        transactionHash: event.transaction.hash,
        txFrom: event.transaction.from ?? "",
        txTo: event.transaction.to ?? "",
        blockNumber: event.block.number,
        chainId: event.chainId,
    };

    context.Supply.set(entity);
});

AaveV3Pool.Borrow.handler(async ({ event, context }) => {
    const asset = await ensureToken(event.params.reserve, event, context);

    const entity: Borrow = {
        id: `${event.transaction.hash}_${event.logIndex}`,
        contractAddress: event.srcAddress,
        reserve: event.params.reserve,
        reserveName: asset.name,
        reserveSymbol: asset.symbol,
        user: event.params.user,
        onBehalfOf: event.params.onBehalfOf,
        amount: event.params.amount,
        amountUSD: calculateUSDAmount(event.params.amount, asset.price, asset.decimals),
        reserveDecimals: asset.decimals,
        interestRateMode: Number(event.params.interestRateMode),
        borrowRate: event.params.borrowRate,
        referralCode: Number(event.params.referralCode),
        timestamp: event.block.timestamp,
        transactionHash: event.transaction.hash,
        txFrom: event.transaction.from ?? "",
        txTo: event.transaction.to ?? "",
        blockNumber: event.block.number,
        chainId: event.chainId,
    };

    context.Borrow.set(entity);
});

AaveV3Pool.Repay.handler(async ({ event, context }) => {
    const asset = await ensureToken(event.params.reserve, event, context);

    const entity: Repay = {
        id: `${event.transaction.hash}_${event.logIndex}`,
        contractAddress: event.srcAddress,
        reserve: event.params.reserve,
        reserveName: asset.name,
        reserveSymbol: asset.symbol,
        user: event.params.user,
        repayer: event.params.repayer,
        amount: event.params.amount,
        amountUSD: calculateUSDAmount(event.params.amount, asset.price, asset.decimals),
        reserveDecimals: asset.decimals,
        useATokens: event.params.useATokens,
        timestamp: event.block.timestamp,
        transactionHash: event.transaction.hash,
        txFrom: event.transaction.from ?? "",
        txTo: event.transaction.to ?? "",
        blockNumber: event.block.number,
        chainId: event.chainId,
    };

    context.Repay.set(entity);
});

AaveV3Pool.LiquidationCall.handler(async ({ event, context }) => {
    const collateralAsset = await ensureToken(event.params.collateralAsset, event, context);
    const debtAsset = await ensureToken(event.params.debtAsset, event, context);

    const entity: Liquidation = {
        id: `${event.transaction.hash}_${event.logIndex}`,
        contractAddress: event.srcAddress,
        collateralAsset: event.params.collateralAsset,
        collateralAssetName: collateralAsset.name,
        collateralAssetSymbol: collateralAsset.symbol,
        debtAsset: event.params.debtAsset,
        debtAssetName: debtAsset.name,
        debtAssetSymbol: debtAsset.symbol,
        user: event.params.user,
        debtToCover: event.params.debtToCover,
        debtToCoverUSD: calculateUSDAmount(event.params.debtToCover, debtAsset.price, debtAsset.decimals),
        debtAssetDecimals: debtAsset.decimals,
        liquidatedCollateralAmount: event.params.liquidatedCollateralAmount,
        liquidatedCollateralAmountUSD: calculateUSDAmount(event.params.liquidatedCollateralAmount, collateralAsset.price, collateralAsset.decimals),
        collateralAssetDecimals: collateralAsset.decimals,
        liquidator: event.params.liquidator,
        receiveAToken: event.params.receiveAToken,
        timestamp: event.block.timestamp,
        transactionHash: event.transaction.hash,
        txFrom: event.transaction.from ?? "",
        txTo: event.transaction.to ?? "",
        blockNumber: event.block.number,
        chainId: event.chainId,
    };

    context.Liquidation.set(entity);
});
