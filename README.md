# TradesLens: Search Intelligence & DEX Terminal

**TradesLens** is a high-performance data pipeline designed to ingest, transform, and analyze swap data across multiple blockchains and Decentralized Exchanges (DEXes). By combining **Envio HyperIndex** for ultra-fast event ingestion and **dbt** for robust data modeling, TradesLens provides a unified view of the DeFi ecosystem.

**[ Live Intelligence Dashboard](https://intel-tradeslens.onrender.com/)**

---

###  Key Features
*   **Multi-Chain Support**: Real-time indexing of Ethereum Mainnet, Arbitrum, and Optimism.
*   **Multi-Protocol Ingestion**: Unified data pipeline for Uniswap V3, SushiSwap V3, and Solidly V3.
*   **Clean Data Marts**: A centralized `fct_dex_swaps` table that unions data from all sources into a standardized, analyst-ready format.
*   **Incremental Processing**: Optimized dbt models that process 10k+ swaps in seconds using incremental merge strategies.
*   **Full Infrastructure**: Containerized deployment using Docker, featuring TimescaleDB for time-series optimization and Hasura for GraphQL API access.

---

### 🛠 Tech Stack
| Tier | Technology | Description |
| :--- | :--- | :--- |
| **Ingestion** | [Envio HyperIndex](https://envio.dev/) | Multi-chain event indexing & factory monitoring |
| **Modeling** | [dbt-core](https://www.getdbt.com/) | Incremental data normalization & Medallion architecture |
| **Database** | [TimescaleDB](https://www.timescale.com/) | Time-series optimized PostgreSQL |
| **Intelligence API** | [FastAPI](https://fastapi.tiangolo.com/) | High-performance search & analytical backend |
| **Frontend** | [React 19](https://react.dev/) + [Vite](https://vitejs.dev/) | Cinematic terminal UI with real-time charting |

---

### 📂 Project Structure
```text
├── Dex-Indexer/      # Envio HyperIndex configuration & event handlers
├── Dex-model/        # dbt project (Staging, Intermediate, and Marts)
└── dashboard/
    ├── backend/      # FastAPI Intelligence API (SQLAlchemy/TimescaleDB)
    └── frontend/     # React 19 Analytical Dashboard (Vite/Tailwind)
```

---

### � Getting Started

#### 1. Environment Configuration
Copy the environment template and configure your Database and RPC credentials:
```bash
cp .env.example .env
```

#### 2. Start the Intelligence Stack
The entire system is containerized for seamless local deployment:
```bash
# Start Backend & API
cd dashboard/backend
docker-compose up --build

# Start Frontend Terminal
cd dashboard/frontend
npm install
npm run dev
```

#### 3. Data Processing
Once the indexer is running, standardize your data using the dbt pipeline:
```bash
cd Dex-model
uv run dbt build
```

---

### 📊 Intelligence Lineage (Medallion Architecture)
1.  **Bronze (Raw)**: Indexed protocol events (Swaps, Mints, Burns) via Envio.
2.  **Silver (Normalized)**: Standardized columns, USD pricing derivation, and chain attribution.
3.  **Gold (Intelligence)**: Unified `fct_dex_swaps` and pre-aggregated analytics for the frontend terminal.

---

### 🛡️ Contributors & Vision
TradesLens is built for transparency and deep on-chain visibility. 
*   **GitHub**: [TradesLens Repository](https://github.com/Freemandaily/TradesLens)
*   **Author**: Onah Innocent (Freeman)

--