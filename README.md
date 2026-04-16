# TradesLens: DeFi Intelligence & Multi-Protocol Terminal

**TradesLens** is a high-performance data pipeline designed to ingest, transform, and analyze on-chain activity across multiple blockchains, Decentralized Exchanges (DEXes), and Lending Protocols. By combining **Envio HyperIndex** for ultra-fast event ingestion and **dbt** for robust data modeling, TradesLens provides a unified, cross-protocol view of the DeFi ecosystem.

**[🚀 Live Intelligence Dashboard](https://intel-tradeslens.onrender.com/)**

---

### 🌟 Key Features
*   **Multi-Chain Support**: Real-time indexing of Ethereum Mainnet, Arbitrum, and Optimism.
*   **Dual-Protocol Intelligence**: 
    *   **DEX Analytics**: Unified data for Uniswap V3, SushiSwap V3, and Solidly V3.
    *   **Lending Marketplace**: Comprehensive tracking of Supply, Borrow, Repay, and Liquidation events (e.g., Aave V3).
*   **Clean Data Marts**: Standardized, analyst-ready format for both Swaps (`fct_dex_swaps`) and Money Markets (`fact_supply`, `fact_borrow`, etc.).
*   **Incremental Processing**: Optimized dbt models that process millions of events in seconds using incremental merge strategies.
*   **Full Infrastructure**: Containerized deployment using Docker, featuring TimescaleDB for time-series optimization and Hasura for GraphQL API access.

---

### 🛠 Tech Stack
| Tier | Technology | Description |
| :--- | :--- | :--- |
| **Ingestion** | [Envio HyperIndex](https://envio.dev/) | Ultra-fast multi-chain event indexing & factory monitoring |
| **Modeling** | [dbt-core](https://www.getdbt.com/) | Incremental data normalization & Medallion architecture |
| **Database** | [TimescaleDB](https://www.timescale.com/) | Time-series optimized PostgreSQL |
| **Intelligence API** | [FastAPI](https://fastapi.tiangolo.com/) | High-performance analytical backend |
| **Frontend** | [React 19](https://react.dev/) + [Vite](https://vitejs.dev/) | Cinematic terminal UI with real-time charting |

---

### 📂 Project Structure
```text
├── Indexers/
│   ├── Dex-Indexer/               # DEX Event Indexing (Swaps, Pools)
│   └── lending-borrowing-indexer/ # Money Market Indexing (Supply, Borrow, Liquidation)
├── model/                         # dbt project (Medallion architecture)
│   ├── models/staging/            # Raw data normalization
│   ├── models/intermediate/       # Cross-chain & asset enrichment
│   └── models/marts/              # Analytical Fact Tables
└── dashboard/
    ├── backend/                   # FastAPI Intelligence API
    └── frontend/                  # React 19 Analytical Dashboard
```

---

### 🚀 Getting Started

#### 1. Environment Configuration
Copy the environment template and configure your Database and RPC credentials:
```bash
cp .env.example .env
```

#### 2. Run the Indexers
The indexers capture real-time events and store them in the database.

**DEX Indexer:**
```bash
cd Indexers/Dex-Indexer
docker-compose up --build
```

**Lending Indexer:**
```bash
cd Indexers/lending-borrowing-indexer
docker-compose up --build
```

#### 3. Data Processing (dbt)
Once the indexers are running and the database is populated, standardize your data using the dbt pipeline:
```bash
cd model
uv run dbt build
```

#### 4. Start the Intelligence Dashboard
```bash
# Start Backend & API
cd dashboard/backend
docker-compose up --build

# Start Frontend
cd ../frontend
npm install && npm run dev
```

---

### 📊 Intelligence Lineage (Medallion Architecture)
1.  **Bronze (Raw)**: Indexed protocol events (Swaps, Supply, Borrow) via Envio HyperIndex.
2.  **Silver (Normalized)**: Standardized columns, USD pricing derivation, and chain attribution (Intermediate layer).
3.  **Gold (Intelligence)**: Unified Fact tables (`fct_dex_swaps`, `fact_supply`, `fact_borrow`) ready for analytical consumption.

---

### 🛡️ Contributors & Vision
TradesLens is built for transparency and deep on-chain visibility. 
*   **GitHub**: [TradesLens Repository](https://github.com/Freemandaily/TradesLens)
*   **Author**: Onah Innocent (Freeman)
*   **X**: [@Freemandayly](https://x.com/freemandayly)