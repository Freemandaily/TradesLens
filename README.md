# TradesLens: Cinematic Search Intelligence & DEX Terminal

**TradesLens** is a high-fidelity, multi-chain intelligence terminal designed to ingest, transform, and visualize swap data across the DeFi ecosystem. By combining **Envio HyperIndex** for ultra-fast ingestion with a cinematic **React Analytical Dashboard**, TradesLens provides deep, real-time insights into asset flows and protocol performance.

---

### �️ Search Intelligence Architecture
TradesLens transforms raw on-chain events into actionable intelligence reports:
*   **Intelligence Search**: Instantly look up transaction hashes, liquidity pools, or assets.
*   **Asset Flow Reporting**: Receipt-style visual breakdowns of Inbound/Outbound asset movements.
*   **Multi-Metric Analytics**: Live tracking of **Total Volume**, **Swap Counts**, and **Average Trade Size**.
*   **Cross-Chain Attribution**: Native support for **Ethereum**, **Arbitrum**, **Optimism**, and **Base** with chain-specific branding.
*   **Cinematic UI/UX**: High-contrast, industrial dark theme optimized for clarity and professional data analysis.

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