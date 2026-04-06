# TradesLens: Multi-Chain DEX Analytics Engine

**TradesLens** is a high-performance data pipeline designed to ingest, transform, and analyze swap data across multiple blockchains and Decentralized Exchanges (DEXes). By combining **Envio HyperIndex** for ultra-fast event ingestion and **dbt** for robust data modeling, TradesLens provides a unified view of the DeFi ecosystem.

---

### 🚀 Key Features
*   **Multi-Chain Support**: Real-time indexing of Ethereum Mainnet, Arbitrum, and Optimism.
*   **Multi-Protocol Ingestion**: Unified data pipeline for Uniswap V3, SushiSwap V3, and Solidly V3.
*   **Clean Data Marts**: A centralized `fct_dex_swaps` table that unions data from all sources into a standardized, analyst-ready format.
*   **Incremental Processing**: Optimized dbt models that process 10k+ swaps in seconds using incremental merge strategies.
*   **Full Infrastructure**: Containerized deployment using Docker, featuring TimescaleDB for time-series optimization and Hasura for GraphQL API access.

---

### 🛠 Tech Stack
*   **Indexer**: [Envio HyperIndex](https://envio.dev/) (Multi-chain Event Indexing)
*   **Transformation**: [dbt-core](https://www.getdbt.com/) (Data Modeling & Testing)
*   **Database**: [TimescaleDB](https://www.timescale.com/) (PostgreSQL with Time-Series extensions)
*   **API Layer**: [Hasura](https://hasura.io/) (Instant GraphQL)
*   **Environment**: Docker 

---

### 📂 Repository Structure
```text
├── Dex-Indexer/      # Envio configuration, handlers, and ABIs
├── Dex-model/        # dbt project (Staging, Intermediate, and Marts)

```

---

### 🛠 Getting Started

#### 1. Setup Environment
Copy the example environment file and fill in your RPC URLs:
```bash
cp .env.example .env
```

#### 2. Start the Indexer
Initialize the Envio HyperIndex and begin data ingestion:
```bash
cd Dex-Indexer
pnpm envio dev
```

#### 3. Build & Run the Analytics Layer
Once data is indexed, run the dbt build to build the unified `fct_dex_swaps` table:
```bash
cd Dex-model
uv run dbt build --full-refresh
```

---

### 📊 Data Lineage
TradesLens follows the **Medallion Architecture**:
1.  **Bronze (Raw)**: Indexed events directly from the blockchain via Envio.
2.  **Silver (Staging/Intermediate)**: Normalized columns, timestamp conversions, and protocol-specific filters.
3.  **Gold (Marts)**: Unified `fct_dex_swaps` and aggregated tables for volume and liquidity analysis.

--