import { experimental_createEffect, S } from "envio";
import { createPublicClient, http } from "viem";
import { mainnet, optimism, arbitrum } from "viem/chains";
import { ADDRESS_ZERO } from "./constants";
import { getChainConfig, getRpcUrl } from "./chains";

// ABI to handle both string and bytes32 (for legacy tokens like MKR)
const ERC20_ABI = [
    { inputs: [], name: "name", outputs: [{ type: "string" }], stateMutability: "view", type: "function" },
    { inputs: [], name: "symbol", outputs: [{ type: "string" }], stateMutability: "view", type: "function" },
    { inputs: [], name: "decimals", outputs: [{ type: "uint8" }], stateMutability: "view", type: "function" },
    { inputs: [], name: "name", outputs: [{ type: "bytes32" }], stateMutability: "view", type: "function" },
    { inputs: [], name: "symbol", outputs: [{ type: "bytes32" }], stateMutability: "view", type: "function" },
] as const;

import { hexToString, isHex } from "viem";

// Cache for viem clients per chainId
const clients: Record<number, any> = {};

function sanitize(result: any): string {
    if (!result) return "";
    let s = "";
    if (typeof result === "string") {
        s = result;
    } else if (isHex(result)) {
        try {
            // Some tokens return hex that is valid string but not bytes32
            s = hexToString(result).replace(/\0/g, "");
        } catch {
            try {
                s = hexToString(result, { size: 32 }).replace(/\0/g, "");
            } catch {
                s = result;
            }
        }
    }
    return s.replace(/[\u0000-\u001F\u007F-\u009F]/g, "").trim();
}

export const getTokensMetadataEffect = experimental_createEffect(
    {
        name: "getTokensMetadata",
        input: { token0: S.string, token1: S.string, chainId: S.number },
        output: {
            meta0: { symbol: S.string, name: S.string, decimals: S.number },
            meta1: { symbol: S.string, name: S.string, decimals: S.number },
        },
        cache: true,
    },
    async ({ input }) => {
        const { token0, token1, chainId } = input;
        const cfg = getChainConfig(chainId);

        const getNativeMeta = () => ({
            name: cfg.nativeTokenDetails.name,
            symbol: cfg.nativeTokenDetails.symbol,
            decimals: Number(cfg.nativeTokenDetails.decimals),
        });

        const isNative0 = token0.toLowerCase() === ADDRESS_ZERO.toLowerCase();
        const isNative1 = token1.toLowerCase() === ADDRESS_ZERO.toLowerCase();

        if (!clients[chainId]) {
            const chain = chainId === 1 ? mainnet : chainId === 10 ? optimism : arbitrum;
            clients[chainId] = createPublicClient({
                chain,
                transport: http(getRpcUrl(chainId)),
            });
        }

        const client = clients[chainId];

        // Advanced Multicall: We fetch raw bytes for name/symbol if possible, 
        // but for now we use the multi-ABI approach which is most compatible.
        const contracts: any[] = [];
        const addCalls = (addr: string) => {
            contracts.push({ address: addr as `0x${string}`, abi: ERC20_ABI, functionName: "symbol" });
            contracts.push({ address: addr as `0x${string}`, abi: ERC20_ABI, functionName: "name" });
            contracts.push({ address: addr as `0x${string}`, abi: ERC20_ABI, functionName: "decimals" });
        };

        if (!isNative0) addCalls(token0);
        if (!isNative1) addCalls(token1);

        let results: any[] = [];
        try {
            results = await client.multicall({ contracts, allowFailure: true });
        } catch (err) {
            // Fallback: If multicall entirely fails (unlikely), results will be empty
        }

        let resIdx = 0;
        const parse = (isNative: boolean, addr: string) => {
            if (isNative) return getNativeMeta();

            const sRes = results[resIdx++];
            const nRes = results[resIdx++];
            const dRes = results[resIdx++];

            // Greedy decoding: try result, then try fallback slices if fails
            let sym = sRes?.status === "success" ? sanitize(sRes.result) : "";
            let nam = nRes?.status === "success" ? sanitize(nRes.result) : "";
            const dec = dRes?.status === "success" ? Number(dRes.result) : 18;

            // If we still don't have a name, use the address slice as the name/symbol
            const identifier = addr.slice(2, 8).toUpperCase();
            if (!sym || sym.length < 1) sym = `TKN-${identifier}`;
            if (!nam || nam.length < 1) nam = `Token ${addr.slice(0, 10)}...`;

            return { symbol: sym, name: nam, decimals: dec };
        };

        return {
            meta0: parse(isNative0, token0),
            meta1: parse(isNative1, token1),
        };
    }
);
