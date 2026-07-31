import { HypersyncClient } from "@envio-dev/hypersync-client";
import * as fs from "fs";
import * as path from "path";
import * as yaml from "js-yaml";
import * as dotenv from "dotenv";

dotenv.config();

const DUNE_API_URL = "https://api.dune.com/api/v1/query/7361962/results?limit=100000&api_key=5G6PxLwYEQzkDcwbRjjrh6K7emxJPV7w";

const NETWORKS = {
    1: { name: "ethereum", url: "https://eth.hypersync.xyz", blocksPerWeek: 50400 },
    42161: { name: "arbitrum", url: "https://arbitrum.hypersync.xyz", blocksPerWeek: 2419200 },
    10: { name: "optimism", url: "https://optimism.hypersync.xyz", blocksPerWeek: 302400 },
};

async function syncPools() {
    console.log("Fetching active pools from Dune...");
    const response = await fetch(DUNE_API_URL);
    if (!response.ok) throw new Error("Failed to fetch Dune data");
    const duneData: any = await response.json();
    const rows = duneData.result?.rows || [];

    console.log(`Found ${rows.length} pools in Dune results.`);

    // Map Dune blockchain names to Chain IDs
    const chainMap: Record<string, number> = {
        "ethereum": 1,
        "arbitrum": 42161,
        "optimism": 10
    };

    const poolsByChain: Record<number, string[]> = { 1: [], 42161: [], 10: [] };
    const registry: Record<string, any> = {};

    rows.forEach((row: any) => {
        const chainId = chainMap[row.blockchain];
        if (chainId && row.pool_address) {
            const pAddr = row.pool_address.toLowerCase();
            poolsByChain[chainId].push(pAddr);

            // Canonicalize token ordering (UniswapV3 order)
            const tA = row.token_bought_address?.toLowerCase();
            const tB = row.token_sold_address?.toLowerCase();

            if (tA && tB) {
                const isT0 = tA < tB;
                const t0 = isT0 ? tA : tB;
                const t1 = isT0 ? tB : tA;

                registry[`${chainId}-${pAddr}`] = {
                    t0,
                    t1,
                    fee: row.fee || 3000,
                    t0Meta: {
                        symbol: isT0 ? row.token_bought_symbol : row.token_sold_symbol,
                        decimals: isT0 ? row.token_bought_decimals : (row.token1_sold_decimals || row.token_sold_decimals)
                    },
                    t1Meta: {
                        symbol: isT0 ? row.token_sold_symbol : row.token_bought_symbol,
                        decimals: isT0 ? (row.token1_sold_decimals || row.token_sold_decimals) : row.token_bought_decimals
                    }
                };
            }
        }
    });

    // Write registry file
    const registryPath = path.join(__dirname, "../src/handlers/utils/poolReg.json");
    fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2));
    console.log(`Pool registry saved to ${registryPath}`);

    const configPath = path.join(__dirname, "../config.yaml");
    const config = yaml.load(fs.readFileSync(configPath, "utf-8")) as any;

    console.log("Updating start blocks and pool addresses...");
    for (const [chainIdStr, info] of Object.entries(NETWORKS)) {
        const chainId = parseInt(chainIdStr);
        const client = new HypersyncClient({
            url: info.url,
            apiToken: process.env.ENVIO_API_TOKEN || ""
        });

        try {
            const currentBlock = await client.getHeight();
            const startBlock = Math.max(0, currentBlock - info.blocksPerWeek);

            const network = config.networks.find((n: any) => n.id === chainId);
            if (network) {
                network.start_block = startBlock;
                const poolContract = network.contracts.find((c: any) => c.name === "UniswapV3Pool");
                if (poolContract) {
                    poolContract.address = poolsByChain[chainId];
                    console.log(`- Chain ${chainId}: ${poolsByChain[chainId].length} pools, start_block ${startBlock}`);
                }
            }
        } catch (e) {
            console.error(`Failed to update chain ${chainId}:`, e);
        }
    }

    fs.writeFileSync(configPath, yaml.dump(config, { noRefs: true, lineWidth: -1 }));
    console.log("\nSuccess! config.yaml and registry are updated.");
}

syncPools().catch(console.error);
