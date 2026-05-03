import { useState, useMemo, useEffect, useRef } from "react";
import axios from "axios";
import uniLogo from "./assets/uniswap.png";
import sushiLogo from "./assets/sushiswap.png";
import solidLogo from "./assets/solidly.png";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Cell, PieChart, Pie
} from "recharts";
import {
  Activity,
  BarChart3,
  Layers,
  Search,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  Box,
  Filter,
  ExternalLink,
  X,
  Clock,
  Zap,
  Cpu,
  ArrowRight,
  Github,
  Twitter,
  Send,
  Linkedin,
  Heart,
  ChevronLeft,
  ChevronRight,
  Image,
  Hash,
  Coins,
  Globe,
  PlusCircle,
  Leaf,
  Flame
} from "lucide-react";

// ── Design tokens ──────────────────────────────────────────────────────────
const C = {
  bg: "#000000",
  surface: "#0a0b0f",
  card: "#000000",
  border: "#1e2028",
  borderHi: "#2a2d38",
  text: "#ffffff",
  muted: "#888d9b",
  dim: "#3a3d48",
  uni: "#3b82f6",
  sushi: "#17C3B2",
  solid: "#A78BFA",
  green: "#22c55e",
  red: "#ef4444",
  amber: "#f59e0b",
};

const PROTOCOLS = {
  uniswap: {
    label: "Uniswap", id: "UniswapV3", color: C.uni, dot: C.uni, logo: uniLogo,
    description: "The leading decentralized exchange protocol, pioneered automated market making (AMM) with concentrated liquidity for maximum capital efficiency."
  },
  sushiswap: {
    label: "Sushiswap", id: "SushiV3", color: C.sushi, dot: C.sushi, logo: sushiLogo,
    description: "A community-focused AMM protocol offering advanced yield opportunities and a robust suite of decentralized financial tools across multiple chains."
  },
  solidly: {
    label: "Solidly", id: "SolidlyV3", color: C.solid, dot: C.solid, logo: solidLogo,
    description: "A next-generation trading protocol utilizing ve(3,3) mechanics to align incentives between liquidity providers and token holders."
  }
};

const CHAINS = ["Ethereum", "Arbitrum", "Optimism"];

const EXPLORERS = {
  "Ethereum": "https://etherscan.io/tx/",
  "Arbitrum": "https://arbiscan.io/tx/",
  "Optimism": "https://optimistic.etherscan.io/tx/",
  "Base": "https://basescan.org/tx/"
};

const TOKEN_EXPLORERS = {
  "Ethereum": "https://etherscan.io/token/",
  "Arbitrum": "https://arbiscan.io/token/",
  "Optimism": "https://optimistic.etherscan.io/token/",
  "Base": "https://basescan.org/token/"
};

const ADDRESS_EXPLORERS = {
  "Ethereum": "https://etherscan.io/address/",
  "Arbitrum": "https://arbiscan.io/address/",
  "Optimism": "https://optimistic.etherscan.io/address/",
  "Base": "https://basescan.org/address/"
};

const CHAIN_COLORS = {
  "Ethereum": "#627EEA",
  "Arbitrum": "#28A0F0",
  "Optimism": "#FF0420",
  "Base": "#0052FF"
};

const NAV = [
  { id: "overview", label: "Overview", icon: BarChart3 },
  { id: "ethereum", label: "Ethereum", logo: "https://cryptologos.cc/logos/ethereum-eth-logo.svg?v=025", color: "#627EEA" },
  { id: "arbitrum", label: "Arbitrum", logo: "https://cryptologos.cc/logos/arbitrum-arb-logo.svg?v=025", color: "#28A0F0" },
  { id: "optimism", label: "Optimism", logo: "https://cryptologos.cc/logos/optimism-ethereum-op-logo.svg?v=025", color: "#FF0420" },
];

const GECKO_MAP = {
  "Ethereum": "eth",
  "Arbitrum": "arbitrum",
  "Optimism": "optimism",
  "Base": "base"
};

// ── Shared primitives ──────────────────────────────────────────────────────
const fmt = (n) => {
  if (n === undefined || n === null) return "$0";
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
};

const fmtNum = (n) => {
  if (n === undefined || n === null) return "0";
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toLocaleString();
};

const getAge = (ts) => {
  const diff = Date.now() - new Date(ts).getTime();
  const sec = Math.floor(diff / 1000);

  if (sec < 60) return `${sec}s ago`;

  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ${sec % 60}s ago`;

  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ${min % 60}m ago`;

  const days = Math.floor(hr / 24);
  if (days < 30) return `${days}d ${hr % 24}h ago`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ${days % 30}d ago`;

  const years = Math.floor(days / 365);
  return `${years}y ${months % 12}mo ago`;
};

const PriceValue = ({ val }) => {
  const num = parseFloat(val);
  if (!num) return "0.00";

  const str = num.toFixed(12);
  const match = str.match(/^0\.0+/);
  if (match && match[0].length > 4) {
    const zeroCount = match[0].length - 2;
    const remaining = str.slice(match[0].length).slice(0, 4);
    return (
      <span style={{ display: "inline-flex", alignItems: "baseline" }}>
        0.0<sub style={{ fontSize: "0.6em", fontWeight: 700, margin: "0 1px" }}>{zeroCount}</sub>{remaining}
      </span>
    );
  }
  return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 });
};
function TrendingTicker({ items, onPoolClick, chain }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="no-scrollbar" style={{
      display: "flex", alignItems: "center", gap: 20, overflowX: "auto",
      padding: "10px 16px", background: "#050505", borderBottom: `1px solid ${C.border}`,
      marginLeft: -32, marginRight: -32, marginTop: -32, marginBottom: 0
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, paddingRight: 16, borderRight: `1px solid ${C.border}` }}>
        <span style={{ fontSize: 12 }}>🔥</span>
      </div>
      {items.map((item, i) => {
        const change = item.price_change_24h || 0;
        const isPos = change >= 0;
        return (
          <div
            key={i}
            onClick={() => onPoolClick && onPoolClick({ pool_address: item.pool_address, chain, pair: item.pair })}
            style={{ display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap", cursor: "pointer" }}
          >
            <div style={{
              background: "rgba(99, 102, 241, 0.15)", color: "#818cf8", fontSize: 10,
              fontWeight: 900, padding: "2px 6px", borderRadius: 4, border: "1px solid rgba(99, 102, 241, 0.3)"
            }}>
              {i + 1}
            </div>
            {item.image_url && (
              <img src={item.image_url} style={{ width: 18, height: 18, borderRadius: "50%" }} alt="t" />
            )}
            <span style={{ fontSize: 12, fontWeight: 800, color: "#fff" }}>{item.symbol}</span>
            <span style={{ fontSize: 11, fontWeight: 800, color: isPos ? C.green : C.red }}>
              {isPos ? "+" : ""}{change.toFixed(2)}%
            </span>
          </div>
        );
      })}
    </div>
  );
}

function PoolSidebar({ data, loading, chain }) {
  if (loading) return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 16, height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center" }}>
        <div className="animate-spin-slow" style={{ width: 32, height: 32, border: `2px solid ${C.border}`, borderTop: `2px solid ${C.uni}`, borderRadius: "50%", margin: "0 auto 16px" }} />
        <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, textTransform: "uppercase" }}>Analyzing Pool...</div>
      </div>
    </div>
  );

  if (!data || !data.data) return null;
  const attr = data.data.attributes;
  if (!attr) return null;
  const token = data.included?.find(i => i.type === "token")?.attributes;

  const Metric = ({ label, value }) => (
    <div style={{ background: "#111318", padding: "4px 10px", borderRadius: 8, border: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <div style={{ fontSize: 9, color: C.muted, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.02em" }}>{label}</div>
      <div style={{ fontSize: 12, fontWeight: 900, color: "#fff" }}>{value}</div>
    </div>
  );

  const ChangeBox = ({ label, val }) => {
    const isPos = parseFloat(val) >= 0;
    return (
      <div style={{ textAlign: "center", padding: "4px 2px", background: "#111318", borderRadius: 6, border: `1px solid ${C.border}` }}>
        <div style={{ fontSize: 8, color: C.muted, fontWeight: 800, marginBottom: 1 }}>{label}</div>
        <div style={{ fontSize: 10, fontWeight: 900, color: isPos ? C.green : C.red }}>
          {isPos ? "+" : ""}{parseFloat(val).toFixed(1)}%
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, height: "100%" }}>
      {/* Identity & Links */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: "14px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: "#000", border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
            {token?.image_url ? <img src={token.image_url} style={{ width: "100%", height: "100%" }} alt="logo" /> : <Coins size={20} color={C.dim} />}
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 900, color: "#fff", display: "flex", alignItems: "center", gap: 8 }}>
              {token?.symbol || "TOKEN"} / {attr.name.split(" / ")[1]?.split(" ")[0]}
              <span style={{ fontSize: 10, color: C.green, display: "flex", alignItems: "center", gap: 4 }}>
                <Leaf size={10} /> {getAge(attr.pool_created_at).split(" ")[0]}
              </span>
            </div>
            <div style={{ fontSize: 11, color: C.muted, display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
              <img src={NAV.find(c => c.label === chain)?.logo} style={{ width: 14, height: 14, borderRadius: "50%" }} alt="chain" />
              {chain}
              <ChevronRight size={12} />
              <img src="https://cryptologos.cc/logos/uniswap-uni-logo.svg?v=025" style={{ width: 14, height: 14 }} alt="dex" />
              <span>Uniswap</span>
              <span style={{ fontSize: 9, padding: "1px 4px", border: `1px solid ${C.border}`, borderRadius: 4, marginLeft: 2, fontWeight: 800 }}>
                {data?.data?.relationships?.dex?.data?.id?.split("_")?.[1]?.toUpperCase() || "V3"}
              </span>
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}>
          <a
            href={data?.metadata?.[0]?.attributes?.websites?.[0] || "#"}
            target="_blank"
            rel="noreferrer"
            style={{ textDecoration: "none", background: "#111318", border: `1px solid ${C.border}`, borderRadius: 8, padding: "6px", color: data?.metadata?.[0]?.attributes?.websites?.[0] ? "#fff" : C.dim, fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
          >
            <Globe size={14} /> Website
          </a>
          <a
            href={data?.metadata?.[0]?.attributes?.twitter_handle ? `https://twitter.com/${data.metadata[0].attributes.twitter_handle}` : "#"}
            target="_blank"
            rel="noreferrer"
            style={{ textDecoration: "none", background: "#111318", border: `1px solid ${C.border}`, borderRadius: 8, padding: "6px", color: data?.metadata?.[0]?.attributes?.twitter_handle ? "#fff" : C.dim, fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
          >
            <Twitter size={14} /> Twitter
          </a>
        </div>
      </div>

      {/* Primary Metrics */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: "14px", display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", gap: 8, paddingBottom: 10, borderBottom: `1px solid ${C.border}` }}>
          <div style={{ flex: 1, background: "#111318", padding: "8px", borderRadius: 8, border: `1px solid ${C.border}`, textAlign: "center" }}>
            <div style={{ fontSize: 8, color: C.muted, fontWeight: 800, textTransform: "uppercase", marginBottom: 4 }}>Price USD</div>
            <div style={{ fontSize: 15, fontWeight: 900, color: "#fff" }}>
              $<PriceValue val={attr.base_token_price_usd} />
            </div>
          </div>
          <div style={{ flex: 1, background: "#111318", padding: "8px", borderRadius: 8, border: `1px solid ${C.border}`, textAlign: "center" }}>
            <div style={{ fontSize: 8, color: C.muted, fontWeight: 800, textTransform: "uppercase", marginBottom: 4 }}>Price</div>
            <div style={{ fontSize: 15, fontWeight: 900, color: "#fff" }}>
              <PriceValue val={attr.base_token_price_quote_token} /> {attr.name.split(" / ")[1]?.split(" ")[0]}
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          <Metric label="Liq" value={fmt(parseFloat(attr.reserve_in_usd))} />
          <Metric label="FDV" value={fmt(parseFloat(attr.fdv_usd))} />
          <Metric label="Cap" value={attr.market_cap_usd ? fmt(parseFloat(attr.market_cap_usd)) : "N/A"} />
          <Metric label="Vol" value={fmt(parseFloat(attr.volume_usd.h24))} />
        </div>
      </div>

      {/* Performance Grid */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: "12px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
          <ChangeBox label="5M" val={attr.price_change_percentage.m5} />
          <ChangeBox label="1H" val={attr.price_change_percentage.h1} />
          <ChangeBox label="6H" val={attr.price_change_percentage.h6} />
          <ChangeBox label="24H" val={attr.price_change_percentage.h24} />
        </div>
      </div>

      {/* Pair Details Section (Based on Screenshot) */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: "14px", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 8, borderBottom: `1px solid ${C.border}` }}>
          <span style={{ fontSize: 12, color: "#fff", fontWeight: 600 }}>Pair created</span>
          <span style={{ fontSize: 12, color: "#fff", fontWeight: 800 }}>{getAge(attr.pool_created_at)}</span>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
          <span style={{ fontSize: 12, color: "#fff", fontWeight: 600 }}>Pooled {token?.symbol}</span>
          <div style={{ textAlign: "right" }}>
            <span style={{ fontSize: 12, color: "#fff", fontWeight: 800 }}>{fmtNum(parseFloat(attr.reserve_in_usd) / 2 / parseFloat(attr.base_token_price_usd))}</span>
            <span style={{ fontSize: 11, color: C.muted, marginLeft: 6 }}>{fmt(parseFloat(attr.reserve_in_usd) / 2)}</span>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
          <span style={{ fontSize: 12, color: "#fff", fontWeight: 600 }}>Pooled {attr.name.split(" / ")[1]?.split(" ")[0]}</span>
          <div style={{ textAlign: "right" }}>
            <span style={{ fontSize: 12, color: "#fff", fontWeight: 800 }}>{fmtNum(parseFloat(attr.reserve_in_usd) / 2 / parseFloat(attr.quote_token_price_usd))}</span>
            <span style={{ fontSize: 11, color: C.muted, marginLeft: 6 }}>{fmt(parseFloat(attr.reserve_in_usd) / 2)}</span>
          </div>
        </div>

        <div style={{ marginTop: 4, display: "flex", flexDirection: "column" }}>
          {[
            { label: "Pair", addr: attr.address, type: "address" },
            { label: token?.symbol, addr: token?.address, type: "token" },
            { label: attr.name.split(" / ")[1]?.split(" ")[0], addr: data.data.relationships.quote_token.data.id.split("_")[1], type: "token" }
          ].map((item, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: i < 2 ? `1px solid ${C.border}` : "none" }}>
              <span style={{ fontSize: 11, color: C.muted, fontWeight: 700 }}>{item.label}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#111318", padding: "3px 8px", borderRadius: 6, border: `1px solid ${C.border}` }}>
                <span style={{ fontSize: 10, color: "#fff", fontFamily: "monospace" }}>{item.addr?.slice(0, 6)}...{item.addr?.slice(-4)}</span>
                <div style={{ width: 1, height: 10, background: C.border }} />
                <a href={`${ADDRESS_EXPLORERS[chain] || "https://etherscan.io/address/"}${item.addr}`} target="_blank" rel="noreferrer" style={{ color: C.dim }}><ExternalLink size={10} /></a>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Security Check */}
    </div>
  );
}

function PoolDetails({ pool, onBack, onPoolClick }) {
  const [swaps, setSwaps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [poolInfo, setPoolInfo] = useState(null);
  const [infoLoading, setInfoLoading] = useState(true);
  const [updatedIds, setUpdatedIds] = useState(new Set());
  const [trendingItems, setTrendingItems] = useState([]);

  useEffect(() => {
    if (!pool?.chain) return;
    axios.get(`/api/v1/swaps/market-trending/${pool.chain.toLowerCase()}`)
      .then(res => setTrendingItems(res.data))
      .catch(err => console.error("Failed to fetch trending:", err));
  }, [pool.chain]);

  const baseSymbol = swaps[0]?.base || "Base";
  const quoteSymbol = swaps[0]?.quote || "Quote";

  const networkSlug = GECKO_MAP[pool.chain] || "eth";
  const chartUrl = `https://www.geckoterminal.com/${networkSlug}/pools/${pool.pool_address}?embed=1&info=0&swaps=0&light_chart=0&bg_color=000000`;

  useEffect(() => {
    if (!pool?.chain || !pool?.pool_address) return;

    setLoading(true);
    const chainName = pool.chain;
    axios.get(`/api/v1/swaps/list/${chainName}/${pool.pool_address}?limit=100`)
      .then(res => {
        setSwaps(res.data || []);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to fetch pool history:", err);
        setSwaps([]);
        setLoading(false);
      });

    setInfoLoading(true);
    const chainSlug = pool.chain.toLowerCase();
    axios.get(`/api/v1/swaps/pool-info/${chainSlug}/${pool.pool_address}`)
      .then(res => {
        setPoolInfo(res.data);
        setInfoLoading(false);
      })
      .catch(err => {
        console.error("Failed to fetch pool intelligence:", err);
        setInfoLoading(false);
      });
  }, [pool?.chain, pool?.pool_address]);

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    const chainSlug = pool.chain.toLowerCase();
    const wsUrl = `${protocol}//${host}/api/v1/swaps/ws/${chainSlug}/${pool.pool_address}`;

    const socket = new WebSocket(wsUrl);

    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === "new_swaps") {
          const newSwaps = message.data;
          setSwaps(prev => {
            const filtered = newSwaps.filter(ns => !prev.some(ps => ps.id === ns.id));
            if (filtered.length === 0) return prev;

            setUpdatedIds(new Set(filtered.map(s => s.id)));
            setTimeout(() => setUpdatedIds(new Set()), 2000);

            return [...filtered, ...prev].slice(0, 500);
          });
        }
      } catch (e) { console.error("WS Error:", e); }
    };

    return () => socket.close();
  }, [pool.chain, pool.pool_address]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {trendingItems && trendingItems.length > 0 && (
        <TrendingTicker items={trendingItems} onPoolClick={onPoolClick} chain={pool.chain} />
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 24, alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Chart Section - Clipped to hide branding */}
          <div style={{
            background: C.card, border: `1px solid ${C.border}`, borderRadius: 16,
            height: 500, overflow: "hidden", position: "relative"
          }}>
            <iframe
              id="geckoterminal-embed"
              title="GeckoTerminal Embed"
              src={chartUrl}
              frameBorder="0"
              allow="clipboard-write"
              allowFullScreen
              style={{
                width: "100%",
                height: "calc(100% + 42px)",
                border: "none",
                position: "absolute",
                top: 0
              }}
            />
          </div>

          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: "24px", position: "relative", minHeight: 600 }}>
            {loading && <ChartLoader />}

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#1c1e22", borderBottom: `1px solid ${C.border}` }}>
                    <th style={{ textAlign: "left", fontSize: 10, color: C.muted, fontWeight: 800, padding: "12px 16px", textTransform: "uppercase" }}>Time</th>
                    <th style={{ textAlign: "left", fontSize: 10, color: C.muted, fontWeight: 800, padding: "12px 16px", textTransform: "uppercase" }}>Type</th>
                    <th style={{ textAlign: "left", fontSize: 10, color: C.muted, fontWeight: 800, padding: "12px 16px", textTransform: "uppercase" }}>USD Value</th>
                    <th style={{ textAlign: "left", fontSize: 10, color: C.muted, fontWeight: 800, padding: "12px 16px", textTransform: "uppercase" }}>{baseSymbol}</th>
                    <th style={{ textAlign: "left", fontSize: 10, color: C.muted, fontWeight: 800, padding: "12px 16px", textTransform: "uppercase" }}>{quoteSymbol}</th>
                    <th style={{ textAlign: "left", fontSize: 10, color: C.muted, fontWeight: 800, padding: "12px 16px", textTransform: "uppercase" }}>Price</th>
                    <th style={{ textAlign: "left", fontSize: 10, color: C.muted, fontWeight: 800, padding: "12px 16px", textTransform: "uppercase" }}>Trader</th>
                    <th style={{ textAlign: "left", fontSize: 10, color: C.muted, fontWeight: 800, padding: "12px 16px", textTransform: "uppercase" }}>TXN</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr>
                      <td colSpan={8} style={{ padding: 60, textAlign: "center" }}>
                        <div className="animate-pulse" style={{ color: C.dim, fontSize: 14 }}>Fetching swap history...</div>
                      </td>
                    </tr>
                  )}
                  {!loading && swaps.length === 0 && (
                    <tr>
                      <td colSpan={8} style={{ padding: 60, textAlign: "center", color: C.dim }}>
                        <div style={{ fontSize: 15, fontWeight: 800, color: "#fff", marginBottom: 6 }}>No Trade History Found</div>
                        <div style={{ fontSize: 12, color: C.muted }}>This pool exists on GeckoTerminal, but our local indexer hasn't recorded any swaps for it yet.</div>
                      </td>
                    </tr>
                  )}
                  {swaps.map((s, i) => (
                    <tr key={s.id} style={{
                      borderBottom: `1px solid ${C.border}`,
                      transition: "background 0.5s",
                      background: updatedIds.has(s.id) ? "rgba(59, 130, 246, 0.15)" : "transparent"
                    }}>
                      <td style={{ padding: "12px 16px", fontSize: 12, color: C.muted }}>{getAge(s.timestamp)}</td>
                      <td style={{ padding: "12px 16px" }}>
                        <span style={{
                          fontSize: 10, fontWeight: 900, padding: "2px 8px", borderRadius: 4,
                          background: s.side === "BUY" ? C.green + "20" : C.red + "20",
                          color: s.side === "BUY" ? C.green : C.red
                        }}>{s.side}</span>
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 800, color: s.side === "BUY" ? C.green : C.red }}>{fmt(s.usd_value)}</td>
                      <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 700, color: s.side === "BUY" ? C.green : C.red }}>
                        {fmtNum(s.amount_base)}
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 700, color: s.side === "BUY" ? C.green : C.red }}>
                        {fmtNum(s.amount_quote)}
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 700, color: s.side === "BUY" ? C.green : C.red }}>
                        <PriceValue val={s.price} />
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <a
                          href={`${ADDRESS_EXPLORERS[pool.chain] || "https://etherscan.io/address/"}${s.tx_from}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ fontSize: 11, color: "#fff", fontFamily: "monospace", textDecoration: "none" }}
                          onMouseEnter={e => e.currentTarget.style.textDecoration = "underline"}
                          onMouseLeave={e => e.currentTarget.style.textDecoration = "none"}
                        >
                          {s.tx_from.slice(0, 6)}...{s.tx_from.slice(-4)}
                        </a>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <a
                          href={`${EXPLORERS[pool.chain] || "https://etherscan.io/tx/"}${s.tx_hash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ fontSize: 11, color: C.dim, fontFamily: "monospace", textDecoration: "none" }}
                          onMouseEnter={e => e.currentTarget.style.color = "#fff"}
                          onMouseLeave={e => e.currentTarget.style.color = C.dim}
                        >
                          <ExternalLink size={12} />
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Intelligence Sidebar */}
        <div style={{ position: "sticky", top: 24 }}>
          <PoolSidebar data={poolInfo} loading={infoLoading} chain={pool.chain} />
        </div>
      </div>
    </div>
  );
}


function StatCard({ label, value, color, icon: Icon }) {
  return (
    <div style={{
      background: C.card, border: `1px solid ${C.border}`,
      borderRadius: 12, padding: "24px",
      transition: "border-color 0.2s",
      cursor: "default"
    }} onMouseEnter={e => e.currentTarget.style.borderColor = C.borderHi}
      onMouseLeave={e => e.currentTarget.style.borderColor = C.border}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: C.muted, fontWeight: 500, letterSpacing: ".06em", textTransform: "uppercase" }}>{label}</div>
        {Icon && <Icon size={14} color={C.dim} />}
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, color: color || C.text, letterSpacing: "-.02em", fontVariantNumeric: "tabular-nums" }}>{value}</div>
    </div>
  );
}

function Badge({ text, color }) {
  return (
    <span style={{
      fontSize: 10, padding: "2px 8px", borderRadius: 20, fontWeight: 600,
      background: color + "15", color, border: `1px solid ${color}30`,
      letterSpacing: ".02em"
    }}>{text}</span>
  );
}

const TOOLTIP_STYLE = {
  background: "#0a0b0f",
  border: `1px solid ${C.borderHi}`,
  borderRadius: 8,
  fontSize: 12,
  color: "#FFFFFF",
  boxShadow: "0 10px 15px -3px rgba(0,0,0,0.8)"
};

function ChartLoader() {
  return (
    <div style={{
      position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 20, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(4px)",
      borderRadius: 10
    }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
        <div style={{ position: "relative", width: 80, height: 80 }}>
          <div className="animate-spin-slow" style={{
            position: "absolute", inset: 0,
            border: `2px solid ${C.border}`,
            borderTop: `2px solid ${C.uni}`,
            borderRadius: "50%"
          }} />
          <div className="animate-spin-fast" style={{
            position: "absolute", inset: 15,
            border: `2px solid transparent`,
            borderBottom: `2px solid ${C.uni}80`,
            borderRadius: "50%"
          }} />
          <div className="chart-pulse" style={{
            position: "absolute", inset: 0,
            display: "flex", alignItems: "center", justifyContent: "center"
          }}>
            <TrendingUp size={24} color={C.uni} />
          </div>
        </div>
        <div className="chart-pulse" style={{ textAlign: "center" }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#FFFFFF", letterSpacing: "-0.04em" }}>
            TradesLens <span style={{ color: C.uni }}>Analytics</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Watermark() {
  return (
    <div style={{
      position: "absolute", inset: 0,
      display: "flex", alignItems: "center", justifyContent: "center",
      pointerEvents: "none", zIndex: 0, overflow: "hidden"
    }}>
      <div style={{
        fontSize: 60, fontWeight: 900, color: "#FFFFFF",
        opacity: 0.05, letterSpacing: "0.12em", textTransform: "uppercase",
        userSelect: "none", whiteSpace: "nowrap"
      }}>
        TradesLens
      </div>
    </div>
  );
}

// ── Concise Inspector Overlay (Floating over Live Feed) ───────────────────

// ── Shared Constants ──────────────────────────────────────────────────────
const MONTHS = [
  { val: "", label: "Full Year" },
  { val: 1, label: "January" }, { val: 2, label: "February" }, { val: 3, label: "March" },
  { val: 4, label: "April" }, { val: 5, label: "May" }, { val: 6, label: "June" },
  { val: 7, label: "July" }, { val: 8, label: "August" }, { val: 9, label: "September" },
  { val: 10, label: "October" }, { val: 11, label: "November" }, { val: 12, label: "December" },
];

// ── Overview page ──────────────────────────────────────────────────────────
function Overview({ alphaMetrics, loading, isGlobalView, updatedPools, onPoolClick }) {
  const [sortConfig, setSortConfig] = useState({ key: "metrics.volume_24h", dir: "desc" });
  const [page, setPage] = useState(0);
  const pageSize = 30;
  const [trendingItems, setTrendingItems] = useState([]);

  const lastChainRef = useRef(null);

  useEffect(() => {
    const chainName = alphaMetrics?.[0]?.chain || "Ethereum";
    if (lastChainRef.current === chainName) return;

    lastChainRef.current = chainName;
    axios.get(`/api/v1/swaps/market-trending/${chainName.toLowerCase()}`)
      .then(res => setTrendingItems(res.data))
      .catch(err => console.error("Failed to fetch trending in Overview:", err));
  }, [alphaMetrics]);

  // Intelligent Nested Sorting
  const getVal = (obj, path) => path.split(".").reduce((o, i) => o?.[i], obj);

  const sortedData = useMemo(() => {
    return [...(alphaMetrics || [])].sort((a, b) => {
      const aVal = getVal(a, sortConfig.key) || 0;
      const bVal = getVal(b, sortConfig.key) || 0;
      return sortConfig.dir === "desc" ? bVal - aVal : aVal - bVal;
    });
  }, [alphaMetrics, sortConfig]);

  useEffect(() => {
    setPage(0);
  }, [alphaMetrics, sortConfig]);

  const paginatedData = useMemo(() => {
    return sortedData.slice(page * pageSize, (page + 1) * pageSize);
  }, [sortedData, page]);

  const toggleSort = (key) => {
    setSortConfig(prev => ({
      key,
      dir: prev.key === key && prev.dir === "desc" ? "asc" : "desc"
    }));
  };

  // Header Definition for Dynamic Rendering
  const HEADERS = [
    { label: "Pair", key: "pair", type: "text" },
    { label: "Price", key: "current_price" },
    { label: "Volume", key: "metrics.total_volume" },
    { label: "24h Vol", key: "metrics.volume_24h" },
    { label: "3d Vol", key: "metrics.volume_3d" },
    { label: "7d Vol", key: "metrics.volume_7d" },
    { label: "Buy (5m)", key: "pressure.buy_5m" },
    { label: "Sell (5m)", key: "pressure.sell_5m" },
    { label: "Buy (10m)", key: "pressure.buy_10m" },
    { label: "Sell (10m)", key: "pressure.sell_10m" }
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {trendingItems && trendingItems.length > 0 && (
        <TrendingTicker items={trendingItems} onPoolClick={onPoolClick} chain={alphaMetrics?.[0]?.chain || "Ethereum"} />
      )}
      {/* Intelligence Section */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: "24px 32px", position: "relative", minHeight: 600 }}>
        {loading && <ChartLoader />}
        {!loading && (!alphaMetrics || alphaMetrics.length === 0) && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 400, color: C.muted }}>
            <Globe size={48} color={C.dim} style={{ marginBottom: 16 }} />
            <div style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>No Intelligence Data Found</div>
            <div style={{ fontSize: 13, marginTop: 8 }}>We couldn't find any active pools matching this ecosystem at the moment.</div>
          </div>
        )}
        <Watermark />

        {/* Timeframe Switcher (Shortcuts) */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", background: "#111318", borderRadius: 8, padding: "3px 4px", border: `1px solid ${C.border}` }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: C.uni, padding: "0 12px", display: "flex", alignItems: "center", gap: 6 }}>
              🔥 Trending
            </span>
            <div style={{ width: 1, height: 12, background: C.border, marginRight: 4 }} />
            {[
              { id: "metrics.volume_24h", label: "24H" },
              { id: "metrics.volume_3d", label: "3D" },
              { id: "metrics.volume_7d", label: "7D" }
            ].map(tf => {
              const active = sortConfig.key === tf.id;
              return (
                <button
                  key={tf.id}
                  onClick={() => setSortConfig({ key: tf.id, dir: "desc" })}
                  style={{
                    padding: "3px 12px", borderRadius: 6, fontSize: 10, fontWeight: 800, cursor: "pointer",
                    background: active ? C.uni : "transparent",
                    color: active ? "#fff" : C.muted,
                    border: "none", transition: "all 0.2s ease"
                  }}>
                  {tf.label}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#1c1e22", borderBottom: `1px solid ${C.border}` }}>
                {HEADERS.map(h => {
                  const isActive = sortConfig.key === h.key;
                  return (
                    <th
                      key={h.key}
                      onClick={() => toggleSort(h.key)}
                      style={{
                        textAlign: "left", fontSize: 10, color: isActive ? C.uni : C.muted,
                        fontWeight: 800, padding: "12px 16px", textTransform: "uppercase",
                        letterSpacing: "0.05em", cursor: "pointer", userSelect: "none",
                        position: "relative"
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center" }}>
                        <span style={{ marginRight: 16 }}>{h.label}</span>
                        {isActive && (
                          <span style={{ fontSize: 12, position: "absolute", right: 8 }}>{sortConfig.dir === "desc" ? "↓" : "↑"}</span>
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {paginatedData.map((m, i) => (
                <tr key={i}
                  onClick={() => onPoolClick(m)}
                  style={{ borderBottom: `1px solid ${C.border}`, transition: "background 0.2s", cursor: "pointer" }}
                  className={`hover-row ${updatedPools?.has(m.pool_address) ? "animate-row-flash" : ""}`}
                >
                  <td style={{ padding: "12px 16px", verticalAlign: "middle" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      {/* Token Multi-Icon Container (Side-by-side) */}
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        {isGlobalView && (
                          <div style={{
                            width: 18, height: 18, borderRadius: 4, background: "#111318", border: `1px solid ${C.border}`,
                            display: "flex", alignItems: "center", justifyContent: "center"
                          }}>
                            <img src={(m.chain?.toLowerCase() || "").includes("eth") ? "https://cryptologos.cc/logos/ethereum-eth-logo.svg?v=025" :
                              (m.chain?.toLowerCase() || "").includes("arb") ? "https://cryptologos.cc/logos/arbitrum-arb-logo.svg?v=025" :
                                "https://cryptologos.cc/logos/optimism-ethereum-op-logo.svg?v=025"}
                              style={{ width: 12, height: 12 }} alt="chain" />
                          </div>
                        )}
                        <div style={{
                          width: 18, height: 18, borderRadius: 4, background: "#111318", border: `1px solid ${C.border}`,
                          display: "flex", alignItems: "center", justifyContent: "center"
                        }}>
                          <img src="https://cryptologos.cc/logos/uniswap-uni-logo.svg?v=025" style={{ width: 12, height: 12 }} alt="uni" />
                        </div>
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
                        <a
                          href={`${TOKEN_EXPLORERS[m.chain] || "https://etherscan.io/token/"}${m.base_token?.address}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            fontSize: 13, fontWeight: 700, color: "#fff", lineHeight: "1.2",
                            textDecoration: "none", transition: "all 0.2s ease"
                          }}
                          onMouseEnter={e => e.currentTarget.style.color = C.uni}
                          onMouseLeave={e => e.currentTarget.style.color = "#fff"}
                        >
                          {m.pair || "Unknown Pair"}
                        </a>
                        <div style={{ fontSize: 10, color: C.muted, lineHeight: "1.2" }}>{m.base_token?.symbol || "???"}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: "12px 16px", verticalAlign: "middle", fontSize: 13, fontWeight: 700, color: "#fff" }}>
                    ${m.current_price?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 }) || "0.00"}
                  </td>
                  <td style={{ padding: "12px 16px", verticalAlign: "middle", fontSize: 14, fontWeight: 800, color: "#fff" }}>
                    {fmt(m.metrics?.total_volume)}
                  </td>
                  <td style={{ padding: "12px 16px", verticalAlign: "middle", fontSize: 14, fontWeight: 700, color: "#fff" }}>
                    {fmt(m.metrics?.volume_24h)}
                  </td>
                  <td style={{ padding: "12px 16px", verticalAlign: "middle", fontSize: 14, fontWeight: 700, color: "#fff" }}>
                    {fmt(m.metrics?.volume_3d)}
                  </td>
                  <td style={{ padding: "12px 16px", verticalAlign: "middle", fontSize: 14, fontWeight: 700, color: "#fff" }}>
                    {fmt(m.metrics?.volume_7d)}
                  </td>
                  <td style={{ padding: "12px 16px", verticalAlign: "middle" }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: C.green }}>{fmt(m.pressure?.buy_5m)}</span>
                  </td>
                  <td style={{ padding: "12px 16px", verticalAlign: "middle" }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: C.red }}>{fmt(m.pressure?.sell_5m)}</span>
                  </td>
                  <td style={{ padding: "12px 16px", verticalAlign: "middle" }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: C.green }}>{fmt(m.pressure?.buy_10m)}</span>
                  </td>
                  <td style={{ padding: "12px 16px", verticalAlign: "middle" }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: C.red }}>{fmt(m.pressure?.sell_10m)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination Section */}
        {sortedData.length > pageSize && (
          <div style={{
            display: "flex", justifyContent: "flex-end", alignItems: "center",
            marginTop: 24, gap: 20, paddingTop: 20, borderTop: `1px solid ${C.border}`
          }}>
            <div style={{ fontSize: 12, color: C.muted, fontWeight: 500 }}>
              Showing pairs <span style={{ color: "#fff", fontWeight: 700 }}>{page * pageSize + 1}–{Math.min((page + 1) * pageSize, sortedData.length)}</span> of <span style={{ color: "#fff", fontWeight: 700 }}>{sortedData.length.toLocaleString()}</span>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button
                disabled={page === 0}
                onClick={() => setPage(p => p - 1)}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  width: 36, height: 36, borderRadius: 8, background: "#111318",
                  border: `1px solid ${C.border}`, cursor: page === 0 ? "not-allowed" : "pointer",
                  color: page === 0 ? C.dim : "#fff", transition: "all 0.2s"
                }}>
                <ChevronLeft size={18} />
              </button>

              <button
                disabled={(page + 1) * pageSize >= sortedData.length}
                onClick={() => setPage(p => p + 1)}
                style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "0 16px",
                  height: 36, borderRadius: 8, background: "#111318",
                  border: `1px solid ${C.border}`, cursor: (page + 1) * pageSize >= sortedData.length ? "not-allowed" : "pointer",
                  color: (page + 1) * pageSize >= sortedData.length ? C.dim : "#fff",
                  fontSize: 12, fontWeight: 700, transition: "all 0.2s"
                }}>
                <span>Pairs {(page + 1) * pageSize + 1}–{Math.min((page + 2) * pageSize, sortedData.length)}</span>
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Protocol page ──────────────────────────────────────────────────────────
function ProtocolView({ proto, analytics, year, setYear, month, setMonth, loading }) {
  const p = PROTOCOLS[proto];
  if (!p) return null; // Safety guard to prevent crash if view is not a protocol

  // Independent state for pool chart
  // Pagination state for pool list
  const [poolPage, setPoolPage] = useState(0);
  const POOLS_PER_PAGE = 6;
  const poolsToDisplay = (analytics?.top_pools || []).slice(poolPage * POOLS_PER_PAGE, (poolPage + 1) * POOLS_PER_PAGE);
  const totalPoolPages = Math.ceil((analytics?.top_pools?.length || 0) / POOLS_PER_PAGE);

  const [poolYear, setPoolYear] = useState(new Date().getFullYear());
  const [poolMonth, setPoolMonth] = useState(new Date().getMonth() + 1);
  const [poolStats, setPoolStats] = useState(null);
  const [poolLoading, setPoolLoading] = useState(false);

  useEffect(() => {
    setPoolLoading(true);
    let url = `/api/v1/swaps/analytics?dex=${p.id}&year=${poolYear}`;
    if (poolMonth) url += `&month=${poolMonth}`;
    axios.get(url).then(res => {
      setPoolStats(res.data);
      setPoolLoading(false);
    }).catch(() => setPoolLoading(false));
  }, [proto, poolYear, poolMonth]);

  if (!analytics && !loading) return <div style={{ padding: 40, color: C.muted }}>No analytics available for {p.label}...</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Protocol Header & Description */}
      <div style={{
        background: C.card, border: `1px solid ${C.border}`, borderRadius: 16,
        padding: "24px", display: "flex", alignItems: "center", gap: 24, marginBottom: 8
      }}>
        <div style={{ width: 64, height: 64, background: "#000", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", border: `1px solid ${C.border}` }}>
          <img src={p.logo} alt={p.label} style={{ width: 44, height: 44, objectFit: "contain" }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
            <span style={{ fontSize: 24, fontWeight: 900, color: "#fff", letterSpacing: "-0.5px" }}>{p.label} Market</span>
            <Badge text="Active Performance" color={p.color} />
          </div>
          <div style={{ fontSize: 13, color: C.muted, maxWidth: 600, lineHeight: 1.5 }}>
            {p.description}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 16 }}>
        <StatCard label="Total Volume" value={fmt(analytics?.summary?.total_volume_usd)} color={p.dot} icon={Activity} />
        <StatCard label="Swap Count" value={fmtNum(analytics?.summary?.total_swaps)} icon={Layers} />
        <StatCard label="Avg Trade Size" value={fmt(analytics?.summary?.avg_trade_size_usd)} icon={TrendingUp} />
        <StatCard label="Efficiency" value="High" icon={Box} />
      </div>

      {/* Main Grid: Volume Trend (Left) | Top Pools Metrics (Right) */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.8fr) minmax(0,1fr)", gap: 16 }}>
        <div style={{
          background: C.card, border: `1px solid ${C.border}`, borderRadius: 12,
          padding: "24px", position: "relative", minHeight: 450
        }}>
          {loading && <ChartLoader />}

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#fff" }}>Volume Trend</div>
            <div style={{ display: "flex", gap: 8 }}>
              <select
                value={year}
                onChange={e => setYear(parseInt(e.target.value))}
                style={{ background: "#111318", border: `1px solid ${C.border}`, color: C.text, fontSize: 12, borderRadius: 6, padding: "4px 8px", outline: "none", fontWeight: 500 }}>
                <option value={2024}>2024</option>
                <option value={2025}>2025</option>
                <option value={2026}>2026</option>
              </select>
              <select
                value={month || ""}
                onChange={e => setMonth(e.target.value === "" ? null : parseInt(e.target.value))}
                style={{ background: "#111318", border: `1px solid ${C.border}`, color: C.text, fontSize: 12, borderRadius: 6, padding: "4px 8px", outline: "none", fontWeight: 500 }}>
                {MONTHS.map(m => <option key={m.label} value={m.val}>{m.label}</option>)}
              </select>
            </div>
          </div>

          <div style={{ position: "relative", height: 344 }}>
            <Watermark />
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={analytics?.performance_chart || []}>
                <defs>
                  <linearGradient id={`grad-${proto}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={p.dot} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={p.dot} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke={C.border} strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fill: "#FFFFFF", fontSize: 11, fontWeight: 500 }} axisLine={{ stroke: C.borderHi, strokeWidth: 1 }} tickLine={false} />
                <YAxis tick={{ fill: "#FFFFFF", fontSize: 11, fontWeight: 500 }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v / 1e6).toFixed(0)}M`} width={54} />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE} itemStyle={{ color: "#FFFFFF" }}
                  labelStyle={{ color: "#FFFFFF", marginBottom: 6, fontWeight: 700 }}
                  formatter={v => [`$${v.toLocaleString()}`, "Volume"]}
                />
                <Area type="monotone" dataKey="volume" stroke={p.dot} strokeWidth={3} fill={`url(#grad-${proto})`} isAnimationActive={!loading} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "24px", display: "flex", flexDirection: "column", minHeight: 450, position: "relative" }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: "#fff", marginBottom: 20 }}>Top {p.label} Pools</div>
          <div style={{ flex: 1 }}>
            {poolsToDisplay.length > 0 ? (
              poolsToDisplay.map((pool, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: i < poolsToDisplay.length - 1 ? `0.5px solid ${C.border}` : "none" }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{pool.pair}</div>
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{pool.pool.slice(0, 10)}...</div>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>{fmt(pool.volume)}</div>
                </div>
              ))
            ) : (
              <div style={{ padding: 40, textAlign: "center", color: C.dim, fontSize: 13 }}>No pools found for this period</div>
            )}
          </div>

          {totalPoolPages > 1 && (
            <div style={{ display: "flex", justifyContent: "center", gap: 10, marginTop: 20, paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
              {[...Array(totalPoolPages)].map((_, i) => (
                <button
                  key={i}
                  onClick={() => setPoolPage(i)}
                  style={{
                    width: 28, height: 28, borderRadius: 6, border: `1px solid ${poolPage === i ? p.dot : C.border}`,
                    background: poolPage === i ? p.dot : "#111318", color: "#fff", fontSize: 11,
                    cursor: "pointer", fontWeight: 700, transition: "all 0.2s"
                  }}>
                  {i + 1}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Pool Volume Bar Chart (Full Width Below Grid) */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "24px", position: "relative", minHeight: 400 }}>
        {poolLoading && <ChartLoader />}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#fff" }}>Pool Volume Distribution</div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>Liquidity flow across pairs</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <select
              value={poolYear}
              onChange={e => setPoolYear(parseInt(e.target.value))}
              style={{ background: "#111318", border: `1px solid ${C.border}`, color: C.text, fontSize: 12, borderRadius: 6, padding: "4px 8px", outline: "none", fontWeight: 500 }}>
              <option value={2024}>2024</option>
              <option value={2025}>2025</option>
              <option value={2026}>2026</option>
            </select>
            <select
              value={poolMonth || ""}
              onChange={e => setPoolMonth(e.target.value === "" ? null : parseInt(e.target.value))}
              style={{ background: "#111318", border: `1px solid ${C.border}`, color: C.text, fontSize: 12, borderRadius: 6, padding: "4px 8px", outline: "none", fontWeight: 500 }}>
              {MONTHS.map(m => <option key={m.label} value={m.val}>{m.label}</option>)}
            </select>
          </div>
        </div>

        <div style={{ position: "relative", height: 320 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={poolStats?.top_pools || []} margin={{ bottom: 20 }}>
              <CartesianGrid vertical={false} stroke={C.border} strokeDasharray="3 3" />
              <XAxis dataKey="pair" tick={{ fill: "#FFFFFF", fontSize: 11, fontWeight: 600 }} axisLine={false} tickLine={false} interval={0} />
              <YAxis tick={{ fill: "#FFFFFF", fontSize: 11, fontWeight: 500 }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v / 1e6).toFixed(1)}M`} width={54} />
              <Tooltip
                contentStyle={TOOLTIP_STYLE} itemStyle={{ color: "#FFFFFF" }}
                labelStyle={{ color: "#FFFFFF", marginBottom: 6, fontWeight: 700 }}
                cursor={{ fill: "rgba(255,255,255,0.05)" }}
                formatter={v => [`$${v.toLocaleString()}`, "Volume"]}
              />
              <Bar dataKey="volume" radius={[4, 4, 0, 0]} barSize={40} isAnimationActive={!poolLoading}>
                {(poolStats?.top_pools || []).map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={index % 2 === 0 ? p.color : p.color + "90"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function SearchIntelligenceModal({ query, isOpen, onClose, onSelect }) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && query) {
      setLoading(true);
      axios.get(`/api/v1/search/?q=${query}`)
        .then(res => {
          setResults(res.data.results || []);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [isOpen, query]);

  if (!isOpen) return null;

  const txs = results.filter(r => r.type === "transaction");
  const tokens = results.filter(r => r.type === "token");
  const pools = results.filter(r => r.type === "pool");

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "rgba(0,0,0,0.6)", backdropFilter: "blur(12px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 40
    }} onClick={onClose}>
      <div style={{
        width: "100%", maxWidth: 900, maxHeight: "80vh",
        background: "#0a0b0f", border: `1px solid ${C.borderHi}`,
        borderRadius: 24, padding: 32, position: "relative",
        boxShadow: "0 30px 60px rgba(0,0,0,0.9)",
        display: "flex", flexDirection: "column", gap: 24, overflow: "hidden"
      }} onClick={e => e.stopPropagation()}>

        {loading && <ChartLoader />}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, color: C.uni, textTransform: "uppercase", letterSpacing: "0.2em" }}>Intelligence Report</div>
          </div>
          <button onClick={onClose} style={{ background: "#ffffff10", border: `1px solid ${C.border}`, borderRadius: 12, padding: 10, cursor: "pointer", color: "#fff" }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 32, paddingRight: 8 }}>
          {results.length === 0 && !loading ? (
            <div style={{ padding: 60, textAlign: "center", color: C.dim }}>No matching intelligence found for this query.</div>
          ) : (
            <>
              {txs.length > 0 && (
                <section>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                    <Hash size={16} color={C.uni} /> Transaction Detail
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    {txs.map((tx, i) => {
                      const explorerUrl = (EXPLORERS[tx.sublabel] || "https://etherscan.io/tx/") + tx.id;
                      return (
                        <div key={i} style={{
                          padding: 24, background: "#111318", border: `1px solid ${C.border}`,
                          borderRadius: 20, position: "relative", overflow: "hidden"
                        }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
                            <div>
                              <div style={{ fontSize: 16, fontWeight: 800, color: "#fff" }}>{tx.label}</div>
                              <div style={{ fontSize: 12, color: CHAIN_COLORS[tx.sublabel] || "#fff", marginTop: 4, fontWeight: 700 }}>{tx.sublabel} • Detected on-chain</div>
                            </div>
                            <a href={explorerUrl} target="_blank" rel="noreferrer" style={{
                              background: C.uni, color: "#fff", padding: "8px 16px", borderRadius: 10,
                              fontSize: 12, fontWeight: 700, textDecoration: "none", display: "flex", alignItems: "center", gap: 8
                            }}>
                              View on Explorer <ExternalLink size={12} />
                            </a>
                          </div>

                          <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 20, background: "rgba(255,255,255,0.03)", padding: 24, borderRadius: 16, border: "1px solid rgba(255,255,255,0.04)" }}>
                            <div style={{ textAlign: "center" }}>
                              <div style={{ fontSize: 10, color: "#ffffff60", textTransform: "uppercase", marginBottom: 8, fontWeight: 800 }}>Bought asset:</div>
                              <div style={{ fontSize: 20, fontWeight: 800, color: C.green }}>{Math.abs(tx.amount_bought).toLocaleString(undefined, { maximumFractionDigits: 2 })} {tx.token_bought}</div>
                            </div>
                            <ArrowUpRight size={22} color={C.muted} />
                            <div style={{ textAlign: "center" }}>
                              <div style={{ fontSize: 10, color: "#ffffff60", textTransform: "uppercase", marginBottom: 8, fontWeight: 800 }}>Sold asset:</div>
                              <div style={{ fontSize: 20, fontWeight: 800, color: C.red }}>{Math.abs(tx.amount_sold).toLocaleString(undefined, { maximumFractionDigits: 2 })} {tx.token_sold}</div>
                            </div>
                          </div>

                          <div style={{ marginTop: 24, display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }}>
                            <div style={{ color: "#ffffff70", fontWeight: 600 }}>Total Value: <span style={{ color: "#fff", fontWeight: 900, marginLeft: 6 }}>${tx.value.toLocaleString()} USD</span></div>
                            <div style={{ color: "#ffffff70", fontWeight: 600 }}>Hash: <span style={{ color: C.uni, fontFamily: "monospace", marginLeft: 6, opacity: 0.9 }}>{tx.id}</span></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 32 }}>
                {pools.length > 0 && (
                  <section>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                      <Layers size={16} color={C.solid} /> Enhanced Pool Analytics
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      {pools.map((p, i) => (
                        <div key={i} style={{ padding: 20, background: "#111318", borderRadius: 16, border: `1px solid ${C.border}`, display: "flex", flexDirection: "column", gap: 16 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div style={{ fontSize: 15, fontWeight: 800, color: "#fff" }}>{p.label}</div>
                            <Badge text={p.sublabel.split("@")[1].trim()} color={C.solid} />
                          </div>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                            <div>
                              <div style={{ fontSize: 9, color: "#ffffff80", textTransform: "uppercase", marginBottom: 4, fontWeight: 800 }}>Total Vol</div>
                              <div style={{ fontSize: 13, fontWeight: 700, color: C.uni }}>${(p.value / 1e3).toFixed(1)}k</div>
                            </div>
                            <div>
                              <div style={{ fontSize: 9, color: "#ffffff80", textTransform: "uppercase", marginBottom: 4, fontWeight: 800 }}>Swaps</div>
                              <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{p.swap_count}</div>
                            </div>
                            <div>
                              <div style={{ fontSize: 9, color: "#ffffff80", textTransform: "uppercase", marginBottom: 4, fontWeight: 800 }}>Avg Trade</div>
                              <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>${(p.avg_trade_size || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {tokens.length > 0 && (
                  <section>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                      <Coins size={16} color={C.green} /> Asset Insights
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {tokens.map((t, i) => (
                        <div key={i} style={{ padding: 16, background: "#111318", borderRadius: 12, border: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>{t.label}</div>
                          <div style={{ fontSize: 13, color: C.green, fontWeight: 800 }}>${(t.value / 1e3).toFixed(1)}k <span style={{ fontSize: 10, color: C.dim, fontWeight: 500 }}>Vol</span></div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
              </div>
            </>
          )}
        </div>

        <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 24, textAlign: "center", fontSize: 12, color: "#ffffff40", fontWeight: 600 }}>
          Press <kbd style={{ padding: "4px 8px", background: C.uni, color: "#fff", borderRadius: 6, fontStyle: "normal", fontWeight: 800, fontSize: 10, margin: "0 4px" }}>ESC</kbd> to close intelligence reporting.
        </div>
      </div>
    </div>
  );
}

// ── App Container ──────────────────────────────────────────────────────────

// ── Global Styles ────────────────────────────────────────────────────────
const GLOBAL_STYLES = `
  .no-scrollbar::-webkit-scrollbar { display: none; }
  .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
  
  @keyframes row-flash {
    0% { background: rgba(34, 197, 94, 0.2); }
    100% { background: transparent; }
  }
  .animate-row-flash { animation: row-flash 2s ease-out; }
  
  @keyframes live-pulse {
    0% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.5; transform: scale(1.2); }
    100% { opacity: 1; transform: scale(1); }
  }
  .animate-live-pulse { animation: live-pulse 2s infinite ease-in-out; }
  
  .animate-spin-slow { animation: spin 3s linear infinite; }
  .animate-spin-fast { animation: spin 1s linear infinite; }
  @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
`;

export default function App() {
  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = GLOBAL_STYLES;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  const [view, setView] = useState("overview");
  const [selectedPool, setSelectedPool] = useState(null);
  const [summary, setSummary] = useState(null);
  const [alphaMetrics, setAlphaMetrics] = useState([]);
  const [protoAnalytics, setProtoAnalytics] = useState({});

  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [loading, setLoading] = useState(false);
  const [protoLoading, setProtoLoading] = useState(false);

  // ... rest of search states ...
  const [searchVal, setSearchVal] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const [wsStatus, setWsStatus] = useState("connecting"); // connecting, open, closed
  const [updatedPools, setUpdatedPools] = useState(new Set());

  const [selectedSwap, setSelectedSwap] = useState(null);

  // Sidebar States
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [suppressHover, setSuppressHover] = useState(false);
  const isEffectiveCollapsed = isCollapsed && (!isHovered || suppressHover);

  const handleSearchResultClick = (item) => {
    if (item.type === "pool") {
      const poolObj = {
        chain: item.sublabel.split("@")[1]?.trim() || "Ethereum",
        pool_address: item.id,
        pair: item.label
      };
      setSelectedPool(poolObj);
      setView("pool");
    } else if (item.type === "token") {
      // Logic for token click
    }
  };

  // 2. Fetch Alpha Metrics for Overview or Specific Chain
  useEffect(() => {
    const fetchGlobalData = async () => {
      setLoading(true);
      setAlphaMetrics([]);

      const params = new URLSearchParams({ limit: "1000" });
      const chainName = CHAINS.find(c => c.toLowerCase() === view.toLowerCase());
      if (chainName) {
        params.append("chain_name", chainName);
      }

      const url = `/api/v1/alpha/metrics?${params.toString()}`;
      axios.get(url)
        .then(res => {
          setAlphaMetrics(res.data || []);
          setLoading(false);
        })
        .catch(err => {
          console.error("Alpha intelligence sync failed:", err);
          setAlphaMetrics([]);
          setLoading(false);
        });
    };

    if (view === "overview" || CHAINS.some(c => c.toLowerCase() === view.toLowerCase())) {
      fetchGlobalData();
    }
  }, [view]);

  // 3. Real-time WebSocket Logic
  useEffect(() => {
    let socket;
    let reconnectTimer;

    const connect = () => {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const hostname = window.location.hostname;
      // Backend is on port 8001 per docker-compose
      const port = "8001";
      const wsUrl = `${protocol}//${hostname}:${port}/api/v1/alpha/ws`;
      console.log(`Connecting to Intelligence Tunnel: ${wsUrl}`);
      socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        console.log("Intelligence tunnel open.");
        setWsStatus("open");
      };

      socket.onmessage = (event) => {
        try {
          const newData = JSON.parse(event.data);
          const isOverviewOrChain = view === "overview" || CHAINS.some(c => c.toLowerCase() === view.toLowerCase());

          if (isOverviewOrChain) {
            setAlphaMetrics(prev => {
              // Create a map for fast lookup
              const updateMap = new Map(newData.map(item => [item.pool_address, item]));
              const newIds = new Set();

              // Only update if we have a previous list to patch
              if (!prev || prev.length === 0) return newData;

              const updatedList = prev.map(oldItem => {
                const newItem = updateMap.get(oldItem.pool_address);
                if (newItem) {
                  const priceChanged = newItem.current_price !== oldItem.current_price;
                  const volChanged = newItem.metrics?.volume_24h !== oldItem.metrics?.volume_24h;
                  if (priceChanged || volChanged) {
                    newIds.add(newItem.pool_address);
                  }
                  return newItem;
                }
                return oldItem;
              });

              if (newIds.size > 0) {
                setUpdatedPools(newIds);
                setTimeout(() => setUpdatedPools(new Set()), 3000);
              }
              return updatedList;
            });
          }
        } catch (err) {
          console.error("Malformed intelligence packet:", err);
        }
      };

      socket.onclose = () => {
        setWsStatus("closed");
        console.log("Intelligence tunnel closed. Reconnecting...");
        reconnectTimer = setTimeout(connect, 5000);
      };

      socket.onerror = () => {
        setWsStatus("closed");
        socket.close();
      };
    };

    connect();

    return () => {
      if (socket) socket.close();
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, [view]);

  useEffect(() => {
    // Only fetch if the view corresponds to a known protocol
    if (view !== "overview" && PROTOCOLS[view]) {
      const dexId = PROTOCOLS[view].id;
      setProtoLoading(true);
      let url = `/api/v1/swaps/analytics?dex=${dexId}&year=${selectedYear}`;
      if (selectedMonth) url += `&month=${selectedMonth}`;

      axios.get(url).then(res => {
        setProtoAnalytics(prev => ({ ...prev, [view]: res.data }));
        setProtoLoading(false);
      }).catch(() => setProtoLoading(false));
    }
  }, [view, selectedYear, selectedMonth]);

  const isProto = view !== "overview";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: C.bg, fontFamily: "'Outfit', sans-serif", color: C.text, overflow: "hidden" }}>
      <SearchIntelligenceModal
        query={searchVal}
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSelect={(item) => {
          setShowModal(false);
          handleSearchResultClick(item);
        }}
      />
      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        <aside
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => {
            setIsHovered(false);
            setSuppressHover(false);
          }}
          style={{
            width: isEffectiveCollapsed ? 68 : 220,
            minWidth: isEffectiveCollapsed ? 68 : 220,
            background: C.surface,
            borderRight: `1px solid ${C.border}`,
            display: "flex", flexDirection: "column",
            height: "100%",
            transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
            overflow: "hidden",
            position: "relative"
          }}>
          <div style={{
            padding: "26px 20px", borderBottom: `1px solid ${C.border}`,
            display: "flex", alignItems: "center", position: "relative",
            minHeight: 82, boxSizing: "border-box"
          }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 10,
              overflow: "hidden", width: "100%"
            }}>
              <div style={{
                width: 26, height: 26, background: C.uni, borderRadius: 6,
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0
              }}>
                <TrendingUp size={16} color="white" />
              </div>
              <span style={{
                fontSize: 20, fontWeight: 800, color: "#fff", letterSpacing: "-0.04em",
                whiteSpace: "nowrap", opacity: isEffectiveCollapsed ? 0 : 1,
                transition: "opacity 0.2s", display: isEffectiveCollapsed ? "none" : "block"
              }}>
                TradesLens
              </span>
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                const newCollapsed = !isCollapsed;
                setIsCollapsed(newCollapsed);
                if (newCollapsed) {
                  setSuppressHover(true);
                } else {
                  setSuppressHover(false);
                }
              }}
              style={{
                position: "absolute", right: isEffectiveCollapsed ? -8 : 12,
                top: "50%", transform: "translateY(-50%)",
                background: isEffectiveCollapsed ? C.uni : "transparent",
                border: "none", color: isEffectiveCollapsed ? "#fff" : C.dim,
                cursor: "pointer", display: "flex", alignItems: "center",
                justifyContent: "center", width: 24, height: 24,
                borderRadius: "50%", zIndex: 30,
                boxShadow: isEffectiveCollapsed ? "0 0 10px rgba(59, 130, 246, 0.4)" : "none",
                transition: "all 0.3s ease"
              }}
            >
              {isEffectiveCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={18} />}
            </button>
          </div>
          <nav style={{ padding: "24px 12px", flex: 1 }}>
            <button onClick={() => setView("overview")}
              style={{
                display: "flex", alignItems: "center", gap: 12, width: "100%", background: view === "overview" ? "#ffffff10" : "transparent",
                border: view === "overview" ? `1px solid ${C.borderHi}` : "1px solid transparent",
                borderRadius: 10, padding: isEffectiveCollapsed ? "12px 0" : "12px 14px", cursor: "pointer", color: view === "overview" ? "#fff" : C.muted,
                fontSize: 14, fontFamily: "inherit", marginBottom: 20, transition: "all 0.25s ease", fontWeight: view === "overview" ? 600 : 500,
                justifyContent: isEffectiveCollapsed ? "center" : "flex-start"
              }}>
              <BarChart3 size={18} strokeWidth={view === "overview" ? 2.5 : 2} color={view === "overview" ? C.uni : C.dim} />
              {!isEffectiveCollapsed && <span>Overview</span>}
            </button>

            {!isEffectiveCollapsed && <div style={{ fontSize: 10, color: C.dim, letterSpacing: ".08em", textTransform: "uppercase", padding: "4px 12px 10px", fontWeight: 700, opacity: 0.8 }}>Network Segments</div>}
            {NAV.filter(n => n.id !== "overview").map(item => {
              const active = view === item.id;
              const Icon = item.icon;
              return (
                <button key={item.id} onClick={() => setView(item.id)}
                  style={{
                    display: "flex", alignItems: "center", gap: 12, width: "100%", background: active ? "#ffffff10" : "transparent",
                    border: active ? `1px solid ${C.borderHi}` : "1px solid transparent",
                    borderRadius: 10, padding: isEffectiveCollapsed ? "12px 0" : "12px 14px", cursor: "pointer", color: active ? "#fff" : C.muted,
                    fontSize: 14, fontFamily: "inherit", marginBottom: 6, transition: "all 0.15s ease", fontWeight: active ? 600 : 500,
                    justifyContent: isEffectiveCollapsed ? "center" : "flex-start"
                  }}>
                  {item.logo ? (
                    <img src={item.logo} style={{ width: 18, height: 18, opacity: active ? 1 : 0.6 }} alt={item.label} />
                  ) : (
                    <Icon size={18} strokeWidth={active ? 2.5 : 2} color={active ? (item.color || C.uni) : C.dim} />
                  )}
                  {!isEffectiveCollapsed && <span>{item.label}</span>}
                </button>
              );
            })}

            {!isEffectiveCollapsed && (
              <div style={{
                marginTop: 12, padding: "14px", borderRadius: 10,
                background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.1)",
                display: "flex", alignItems: "center", gap: 12, opacity: 0.6
              }}>
                <PlusCircle size={18} color={C.dim} strokeWidth={1.5} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>Protocol Incoming</div>
                  <div style={{ fontSize: 10, color: C.dim, marginTop: 2, fontWeight: 500 }}>Expansion in progress</div>
                </div>
              </div>
            )}
          </nav>

          <div style={{
            padding: "20px", borderTop: `1px solid ${C.border}`,
            display: "flex", justifyContent: "center", gap: isEffectiveCollapsed ? 0 : 16,
            flexDirection: isEffectiveCollapsed ? "column" : "row",
            alignItems: "center"
          }}>
            <a href="https://github.com/Freemandaily/TradesLens" target="_blank" rel="noreferrer" title="Github" style={{ color: C.dim, transition: "color 0.2s", marginBottom: isEffectiveCollapsed ? 12 : 0 }} onMouseEnter={e => e.currentTarget.style.color = "#fff"} onMouseLeave={e => e.currentTarget.style.color = C.dim}><Github size={16} /></a>
            <a href="https://twitter.com/freemandayly" target="_blank" rel="noreferrer" title="Twitter" style={{ color: C.dim, transition: "color 0.2s", marginBottom: isEffectiveCollapsed ? 12 : 0 }} onMouseEnter={e => e.currentTarget.style.color = "#1DA1F2"} onMouseLeave={e => e.currentTarget.style.color = C.dim}><Twitter size={16} /></a>
            <a href="https://t.me/freemanonah" target="_blank" rel="noreferrer" title="Telegram" style={{ color: C.dim, transition: "color 0.2s", marginBottom: isEffectiveCollapsed ? 12 : 0 }} onMouseEnter={e => e.currentTarget.style.color = "#24A1DE"} onMouseLeave={e => e.currentTarget.style.color = C.dim}><Send size={16} /></a>
            <a href="https://www.linkedin.com/in/onah-innocent-69ba32112/" target="_blank" rel="noreferrer" title="LinkedIn" style={{ color: C.dim, transition: "color 0.2s" }} onMouseEnter={e => e.currentTarget.style.color = "#0077b5"} onMouseLeave={e => e.currentTarget.style.color = C.dim}><Linkedin size={16} /></a>
          </div>
        </aside>

        <main style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, background: "#000000", overflow: "hidden" }}>
          <header style={{
            padding: "20px 32px", borderBottom: `1px solid ${C.border}`,
            display: "flex", alignItems: "center", justifyContent: "space-between",
            background: "#000000", position: "sticky", top: 0, zIndex: 10,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <span style={{ fontSize: 16, fontWeight: 800, color: "#fff" }}>
                {view === "overview" ? "Ecosystem Overview" : (CHAINS.find(c => c.toLowerCase() === view) || PROTOCOLS[view]?.label)}
              </span>

            </div>
          </header>

          <div style={{ padding: "32px", flex: 1, overflowY: "auto" }}>

            {(() => {
              const viewLow = view.toLowerCase();
              const isChain = ["ethereum", "arbitrum", "optimism"].includes(viewLow);
              const isOverview = viewLow === "overview";

              if (isOverview || isChain) {
                return (
                  <Overview
                    alphaMetrics={alphaMetrics}
                    loading={loading}
                    isGlobalView={isOverview}
                    updatedPools={updatedPools}
                    onPoolClick={(pool) => {
                      setSelectedPool(pool);
                      setView("pool");
                    }}
                  />
                );
              }

              if (view === "pool" && selectedPool) {
                return (
                  <PoolDetails
                    pool={selectedPool}
                    onBack={() => setView("overview")}
                    onPoolClick={(p) => setSelectedPool(p)}
                  />
                );
              }

              return (
                <ProtocolView
                  proto={view}
                  analytics={protoAnalytics[view]}
                  year={selectedYear} setYear={setSelectedYear}
                  month={selectedMonth} setMonth={setSelectedMonth}
                  loading={protoLoading}
                />
              );
            })()}
          </div>
        </main>
      </div>
    </div>
  );
}

