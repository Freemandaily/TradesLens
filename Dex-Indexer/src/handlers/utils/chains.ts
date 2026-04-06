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
    // For UniswapV3 — used as the reference pricing pool
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
    // per-DEX factory addresses on this chain
    factories: {
        UniswapV3?: string;
        SolidlyV3?: string;
        SushiV3?: string;
    };
}

// ─── Mainnet ──────────────────────────────────────────────────────────────────
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
        "0x0000000000085d4780b73119b644ae5ecd22b376", // TUSD
        "0x956f47f50a910163d8bf957cf5846d573e7f87ca", // FEI
    ],
    whitelistTokens: [
        "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2", // WETH
        "0x6b175474e89094c44da98b954eedeac495271d0f", // DAI
        "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", // USDC
        "0xdac17f958d2ee523a2206206994597c13d831ec7", // USDT
        "0x0000000000085d4780b73119b644ae5ecd22b376", // TUSD
        "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599", // WBTC
        "0x5d3a536e4d6dbd6114cc1ead35777bab948e3643", // cDAI
        "0x39aa39c021dfbae8fac545936693ac917d5e7563", // cUSDC
        "0x57ab1ec28d129707052df4df418d58a2d46d5f51", // sUSD
        "0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2", // MKR
        "0xc00e94cb662c3520282e6f5717214004a7f26888", // COMP
        "0x514910771af9ca656af840dff83e8264ecf986ca", // LINK
        "0x956f47f50a910163d8bf957cf5846d573e7f87ca", // FEI
        "0x7d1afa7b718fb893db30a3abc0cfc608aacfebb0", // MATIC
        "0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9", // AAVE
    ],
    tokenOverrides: [
        { address: "0xe0b7927c4af23765cb51314a0e0521a9645f0e2a", symbol: "DGD", name: "DGD", decimals: 9n },
        { address: "0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9", symbol: "AAVE", name: "Aave Token", decimals: 18n },
        { address: "0xbb9bc244d798123fde783fcc1c72d3bb8c189413", symbol: "TheDAO", name: "TheDAO", decimals: 16n },
    ],
    poolsToSkip: ["0x8fe8d9bb8eeba3ed688069c3d6b556c9ca258248"],
    nativeTokenDetails: { symbol: "ETH", name: "Ethereum", decimals: 18n },
    factories: {
        UniswapV3: "0x1f98431c8ad98523631ae4a59f267346ea31f984",
        SolidlyV3: "0x777de5Fe8117cAAA7B44f396E93a401Cf5c9D4d6", // Updated Solidly V3 mainnet
        SushiV3: "0xbaceb8ec6b9355dfc0269c18bac9d6e2bdc29c4f", // SushiSwap V3 mainnet
    },
};

// ─── Arbitrum ─────────────────────────────────────────────────────────────────
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
        "0x0000000000000000000000000000000000000000", // native ETH
    ],
    tokenOverrides: [],
    poolsToSkip: [],
    nativeTokenDetails: { symbol: "ETH", name: "Ethereum", decimals: 18n },
    factories: {
        UniswapV3: "0x1f98431c8ad98523631ae4a59f267346ea31f984",
        SushiV3: "0x1af415a1eba07a4986a52b6f2e7de7003d82231e", // SushiSwap V3 Arbitrum
    },
};

// ─── Optimism ─────────────────────────────────────────────────────────────────
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
        "0x0000000000000000000000000000000000000000", // native ETH
    ],
    tokenOverrides: [],
    poolsToSkip: [
        "0x282b7d6bef6c78927f394330dca297eca2bd18cd",
        "0x5738de8d0b864d5ef5d65b9e05b421b71f2c2eb4",
    ],
    nativeTokenDetails: { symbol: "ETH", name: "Ethereum", decimals: 18n },
    factories: {
        UniswapV3: "0x1f98431c8ad98523631ae4a59f267346ea31f984",
        SushiV3: "0x9c6522117e2ed1fe5bdb72bb0ed5e3f2bde7dbe0", // SushiSwap V3 Optimism (CORRECTED)
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

// ─── Factory ID helper ────────────────────────────────────────────────────────
// Factory entity id: "<chainId>-<factoryAddress>-<dex>"
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
