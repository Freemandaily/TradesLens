import { BigDecimal } from "generated";

export interface NativeTokenDetails {
    symbol: string;
    name: string;
    decimals: bigint;
}

export interface StaticTokenDefinition {
    address: string;
    symbol: string;
    name: string;
    decimals: bigint;
}

export interface ChainConfig {
    stablecoinWrappedNativePoolId: string;
    stablecoinIsToken0: boolean;
    stablecoinDecimals: bigint;
    wrappedNativeAddress: string;
    minimumNativeLocked: BigDecimal;
    stablecoinAddresses: string[];
    whitelistTokens: string[];
    tokenOverrides: StaticTokenDefinition[];
    poolsToSkip: string[];
    nativeTokenDetails: NativeTokenDetails;
    factories: {
        UniswapV3?: string;
    };
}

const MAINNET: ChainConfig = {
    stablecoinWrappedNativePoolId: "0x8ad599c3a0ff1de082011efddc58f1908eb6e6d8",
    stablecoinIsToken0: true,
    stablecoinDecimals: 6n,
    wrappedNativeAddress: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
    minimumNativeLocked: new BigDecimal("0.001"),
    stablecoinAddresses: [
        "0x6b175474e89094c44da98b954eedeac495271d0f", // DAI
        "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", // USDC
        "0xdac17f958d2ee523a2206206994597c13d831ec7", // USDT
    ],
    whitelistTokens: [
        "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2", // WETH
        "0x6b175474e89094c44da98b954eedeac495271d0f", // DAI
        "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", // USDC
        "0xdac17f958d2ee523a2206206994597c13d831ec7", // USDT
        "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599", // WBTC
    ],
    tokenOverrides: [],
    poolsToSkip: [],
    nativeTokenDetails: { symbol: "ETH", name: "Ethereum", decimals: 18n },
    factories: {
        UniswapV3: "0x1f98431c8ad98523631ae4a59f267346ea31f984",
    },
};

const ARBITRUM: ChainConfig = {
    stablecoinWrappedNativePoolId: "0x17c14d2c404d167802b16c450d3c99f88f2c4f4d",
    stablecoinIsToken0: false,
    stablecoinDecimals: 6n,
    wrappedNativeAddress: "0x82af49447d8a07e3bd95bd0d56f35241523fbab1",
    minimumNativeLocked: new BigDecimal("0.01"),
    stablecoinAddresses: [
        "0xff970a61a04b1ca14834a43f5de4533ebddb5cc8", // USDC.e
        "0xda10009cbd5d07dd0cecc66161fc93d7c9000da1", // DAI
        "0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9", // USDT
        "0xaf88d065e77c8cc2239327c5edb3a432268e5831", // USDC
    ],
    whitelistTokens: [
        "0x82af49447d8a07e3bd95bd0d56f35241523fbab1", // WETH
        "0xff970a61a04b1ca14834a43f5de4533ebddb5cc8", // USDC.e
        "0xda10009cbd5d07dd0cecc66161fc93d7c9000da1", // DAI
        "0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9", // USDT
        "0xaf88d065e77c8cc2239327c5edb3a432268e5831", // USDC
    ],
    tokenOverrides: [],
    poolsToSkip: [],
    nativeTokenDetails: { symbol: "ETH", name: "Ethereum", decimals: 18n },
    factories: {
        UniswapV3: "0x1f98431c8ad98523631ae4a59f267346ea31f984",
    },
};

const OPTIMISM: ChainConfig = {
    stablecoinWrappedNativePoolId: "0x03af20bdaaffb4cc0a521796a223f7d85e2aac31",
    stablecoinIsToken0: false,
    stablecoinDecimals: 18n,
    wrappedNativeAddress: "0x4200000000000000000000000000000000000006",
    minimumNativeLocked: new BigDecimal("0.01"),
    stablecoinAddresses: [
        "0xda10009cbd5d07dd0cecc66161fc93d7c9000da1", // DAI
        "0x7f5c764cbc14f9669b88837ca1490cca17c31607", // USDC.e
        "0x94b008aa00579c1307b0ef2c499ad98a8ce58e58", // USDT
        "0x0b2c639c533813f4aa9d7837caf62653d097ff85", // USDC
    ],
    whitelistTokens: [
        "0x4200000000000000000000000000000000000006", // WETH
        "0xda10009cbd5d07dd0cecc66161fc93d7c9000da1", // DAI
        "0x7f5c764cbc14f9669b88837ca1490cca17c31607", // USDC.e
        "0x94b008aa00579c1307b0ef2c499ad98a8ce58e58", // USDT
        "0x4200000000000000000000000000000042000000", // OP
        "0x0b2c639c533813f4aa9d7837caf62653d097ff85", // USDC
    ],
    tokenOverrides: [],
    poolsToSkip: [],
    nativeTokenDetails: { symbol: "ETH", name: "Ethereum", decimals: 18n },
    factories: {
        UniswapV3: "0x1f98431c8ad98523631ae4a59f267346ea31f984",
    },
};

export const CHAIN_CONFIGS: { [chainId: number]: ChainConfig } = {
    1: MAINNET,
    42161: ARBITRUM,
    10: OPTIMISM,
};

export function getChainConfig(chainId: number): ChainConfig {
    const cfg = CHAIN_CONFIGS[chainId];
    if (!cfg) throw new Error(`No config for chainId ${chainId}`);
    return cfg;
}

export function factoryId(chainId: number, dex: string): string {
    const cfg = CHAIN_CONFIGS[chainId];
    if (!cfg) throw new Error(`No config for chainId ${chainId}`);
    const addr = cfg.factories[dex as keyof typeof cfg.factories];
    if (!addr) throw new Error(`No factory for ${dex} on chain ${chainId}`);
    return `${chainId}-${addr.toLowerCase()}-${dex}`;
}

export function getRpcUrl(chainId: number): string {
    switch (chainId) {
        case 1: return process.env.ENVIO_MAINNET_RPC_URL || "https://eth.llamarpc.com";
        case 42161: return process.env.ENVIO_ARBITRUM_RPC_URL || "https://arb1.arbitrum.io/rpc";
        case 10: return process.env.ENVIO_OPTIMISM_RPC_URL || "https://mainnet.optimism.io";
        default: throw new Error(`No RPC URL for chainId ${chainId}`);
    }
}
