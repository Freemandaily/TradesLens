import { useState, useMemo, useEffect } from "react";
import axios from "axios";
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
  PlusCircle
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
  uniswap: { label: "Uniswap", id: "UniswapV3", color: C.uni, dot: "#3b82f6", share: 0 },
  sushiswap: { label: "Sushiswap", id: "SushiV3", color: C.sushi, dot: "#17C3B2", share: 0 },
  solidly: { label: "Solidly", id: "SolidlyV3", color: C.solid, dot: "#A78BFA", share: 0 },
};

const CHAINS = ["Ethereum", "Arbitrum", "Optimism"];

const EXPLORERS = {
  "Ethereum": "https://etherscan.io/tx/",
  "Arbitrum": "https://arbiscan.io/tx/",
  "Optimism": "https://optimistic.etherscan.io/tx/"
};

const CHAIN_COLORS = {
  "Ethereum": "#627EEA",
  "Arbitrum": "#28A0F0",
  "Optimism": "#FF0420",
  "Base": "#0052FF"
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

const getAge = (timestamp) => {
  if (!timestamp) return "-";
  const now = new Date();
  const diff = Math.floor((now - new Date(timestamp)) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

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

function ProtoDot({ proto }) {
  const key = proto?.toLowerCase().includes("uniswap") ? "uniswap" :
    proto?.toLowerCase().includes("sushi") ? "sushiswap" :
      proto?.toLowerCase().includes("solid") ? "solidly" : null;
  return <span style={{ width: 7, height: 7, borderRadius: "50%", background: (key && PROTOCOLS[key]?.dot) || C.muted, display: "inline-block", marginRight: 6, flexShrink: 0 }} />;
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
function SwapDetailOverlay({ swap, onClose }) {
  if (!swap) return null;
  const explorerUrl = (EXPLORERS[swap.chain] || "https://etherscan.io/tx/") + swap.tx_hash;

  return (
    <div
      onClick={onClose}
      style={{
        position: "absolute", inset: 0, zIndex: 100,
        background: "rgba(0,0,0,0.4)", backdropFilter: "blur(6px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        borderRadius: 12, padding: 30
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 440, background: "#0a0b0f",
          border: `1px solid ${C.borderHi}`, borderRadius: 16,
          boxShadow: "0 20px 40px rgba(0, 0, 0, 0.8)",
          padding: 24, position: "relative"
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: "absolute", top: 16, right: 16,
            background: "rgba(255,255,255,0.05)", border: "none",
            borderRadius: 8, padding: 6, cursor: "pointer", color: "#fff"
          }}>
          <X size={16} />
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <Zap size={16} color={C.uni} />
          <span style={{ fontSize: 13, fontWeight: 800, color: "#fff" }}>Transaction Detail</span>
        </div>

        {/* Swap Flow Concise */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 12, background: "#111318", borderRadius: 10, border: `1px solid ${C.border}` }}>
            <div>
              <div style={{ fontSize: 9, color: C.muted, textTransform: "uppercase", fontWeight: 700 }}>Inbound Asset</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "rgba(74, 222, 128, 0.9)" }}>{Math.abs(swap.amount_bought).toLocaleString(undefined, { maximumFractionDigits: 2 })} {swap.token_bought}</div>
            </div>
            <ArrowUpRight size={18} color="rgba(74, 222, 128, 0.4)" />
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 12, background: "#111318", borderRadius: 10, border: `1px solid ${C.border}` }}>
            <div>
              <div style={{ fontSize: 9, color: C.muted, textTransform: "uppercase", fontWeight: 700 }}>Outbound Asset</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "rgba(248, 113, 113, 0.9)" }}>{Math.abs(swap.amount_sold).toLocaleString(undefined, { maximumFractionDigits: 2 })} {swap.token_sold}</div>
            </div>
            <ArrowDownRight size={18} color="rgba(248, 113, 113, 0.4)" />
          </div>
        </div>

        {/* Info Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
          <div style={{ background: "#000", border: `1px solid ${C.border}`, borderRadius: 10, padding: 12 }}>
            <div style={{ fontSize: 10, color: C.muted, marginBottom: 4 }}>Protocol</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>{swap.dex}</div>
            <div style={{ fontSize: 10, color: C.muted }}>{swap.chain}</div>
          </div>

          <div style={{ background: "#000", border: `1px solid ${C.border}`, borderRadius: 10, padding: 12 }}>
            <div style={{ fontSize: 10, color: C.muted, marginBottom: 4 }}>Explorer Status</div>
            <a href={explorerUrl} target="_blank" rel="noreferrer" style={{ fontSize: 11, fontWeight: 700, color: C.uni, textDecoration: "none", display: "flex", alignItems: "center", gap: 6 }}>
              View Tx <ExternalLink size={10} />
            </a>
            <div style={{ fontSize: 9, color: C.muted, fontFamily: "monospace" }}>{swap.tx_hash.slice(0, 14)}...</div>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", background: C.uni + "10", border: `1px solid ${C.uni}30`, borderRadius: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: C.uni }}>Total Value (USD)</span>
          <span style={{ fontSize: 14, fontWeight: 900, color: "#fff" }}>{fmt(swap.amount_usd)}</span>
        </div>

        <div style={{ marginTop: 16, fontSize: 10, color: C.dim, textAlign: "center" }}>
          {swap.timestamp ? new Date(swap.timestamp).toLocaleString() : "Syncing..."}
        </div>
      </div>
    </div>
  );
}


// ── Shared Constants ──────────────────────────────────────────────────────
const MONTHS = [
  { val: "", label: "Full Year" },
  { val: 1, label: "January" }, { val: 2, label: "February" }, { val: 3, label: "March" },
  { val: 4, label: "April" }, { val: 5, label: "May" }, { val: 6, label: "June" },
  { val: 7, label: "July" }, { val: 8, label: "August" }, { val: 9, label: "September" },
  { val: 10, label: "October" }, { val: 11, label: "November" }, { val: 12, label: "December" },
];

// ── Overview page ──────────────────────────────────────────────────────────
function Overview({ summary, volumeData, year, setYear, month, setMonth, loading }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 16 }}>
        <StatCard label="Total volume (All-time)" value={fmt(summary?.total_volume_usd)} icon={Activity} />
        <StatCard label="Total swaps" value={fmtNum(summary?.total_swaps)} icon={Layers} />
        <StatCard label="Chains Tracked" value={summary?.chains_tracked || 0} icon={Box} />
        <StatCard label="Protocols Tracked" value={Object.keys(PROTOCOLS).length} icon={Globe} />
      </div>

      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "22px 24px", position: "relative", minHeight: 400 }}>
        {loading && <ChartLoader />}
        <Watermark />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: "#fff" }}>Global Ecosystem Volume</span>
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
        </div>

        <div style={{ position: "relative", height: 320 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={volumeData}>
              <defs>
                <linearGradient id="colorVol" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={C.uni} stopOpacity={0.4} />
                  <stop offset="95%" stopColor={C.uni} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke={C.border} strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fill: "#FFFFFF", fontSize: 11, fontWeight: 500 }} axisLine={{ stroke: C.borderHi, strokeWidth: 1 }} tickLine={false} />
              <YAxis tick={{ fill: "#FFFFFF", fontSize: 11, fontWeight: 500 }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v / 1e6).toFixed(0)}M`} width={54} />
              <Tooltip
                contentStyle={TOOLTIP_STYLE} itemStyle={{ color: "#FFFFFF" }}
                labelStyle={{ color: "#FFFFFF", marginBottom: 6, fontWeight: 700 }}
                formatter={(v) => [`$${v.toLocaleString()}`, "Volume"]}
              />
              <Area type="monotone" dataKey="volume" stroke={C.uni} fillOpacity={1} fill="url(#colorVol)" strokeWidth={3} isAnimationActive={!loading} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.2fr) minmax(0,1fr)", gap: 16 }}>
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "20px 24px", position: "relative" }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#fff", marginBottom: 16 }}>Chain Distribution</div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Chain", "Volume", "Share"].map(h => (
                  <th key={h} style={{ textAlign: h === "Chain" ? "left" : "right", fontSize: 12, color: "#fff", fontWeight: 600, paddingBottom: 15, borderBottom: `1px solid ${C.border}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {summary?.volume_by_chain?.map(row => (
                <tr key={row.chain}>
                  <td style={{ padding: "14px 0", borderBottom: `0.5px solid ${C.border}`, fontSize: 14, fontWeight: 500 }}>{row.chain}</td>
                  <td style={{ textAlign: "right", fontSize: 13, color: "#fff", fontVariantNumeric: "tabular-nums", borderBottom: `0.5px solid ${C.border}` }}>{fmt(row.volume)}</td>
                  <td style={{ textAlign: "right", fontSize: 13, color: C.muted, borderBottom: `0.5px solid ${C.border}` }}>
                    {summary.total_volume_usd > 0 ? ((row.volume / summary.total_volume_usd) * 100).toFixed(1) : 0}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "20px 24px", position: "relative" }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#fff", marginBottom: 16 }}>DEX Performance</div>
          {summary?.volume_by_dex?.map((row, i) => (
            <div key={row.dex} style={{ padding: "14px 0", borderBottom: i < summary.volume_by_dex.length - 1 ? `0.5px solid ${C.border}` : "none" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <ProtoDot proto={row.dex} />
                  <span style={{ fontSize: 14, fontWeight: 500 }}>{row.dex}</span>
                </div>
                <span style={{ fontSize: 14, fontWeight: 700 }}>{fmt(row.volume)}</span>
              </div>
              <div style={{ marginTop: 10, height: 6, borderRadius: 3, background: C.border }}>
                <div style={{ height: 6, borderRadius: 3, background: row.dex.toLowerCase().includes("uni") ? C.uni : row.dex.toLowerCase().includes("sushi") ? C.sushi : C.solid, width: `${summary.total_volume_usd > 0 ? (row.volume / summary.total_volume_usd * 100) : 0}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Protocol page ──────────────────────────────────────────────────────────
function ProtocolView({ proto, analytics, year, setYear, month, setMonth, loading }) {
  const p = PROTOCOLS[proto];

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
      {/* Protocol Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ width: 12, height: 12, borderRadius: "50%", background: p.dot }} />
        <span style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>{p.label} Intelligence</span>
        <Badge text="Live Performance" color={p.color} />
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

function SwapTable({
  swaps,
  title = "Live swap feed",
  chain, setChain,
  dex, setDex,
  minUSD, setMinUSD,
  fixedDex = null
}) {
  const [selectedSwap, setSelectedSwap] = useState(null);

  return (
    <div style={{ position: "relative", background: "#000000", border: `1px solid ${C.border}`, borderRadius: 12, padding: "24px" }}>
      <SwapDetailOverlay swap={selectedSwap} onClose={() => setSelectedSwap(null)} />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: C.green, boxShadow: `0 0 12px ${C.green}80` }} />
          <span style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>{title}</span>
        </div>

        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#111318", borderRadius: 8, padding: "6px 14px", border: `1px solid ${C.border}` }}>
            <Filter size={14} color={C.muted} />
            <select
              value={chain || ""}
              onChange={e => setChain(e.target.value || null)}
              style={{ background: "transparent", border: "none", color: "#fff", fontSize: 12, outline: "none", cursor: "pointer", fontWeight: 600 }}>
              <option value="" style={{ background: "#0a0b0f" }}>All Chains</option>
              {CHAINS.map(c => <option key={c} value={c} style={{ background: "#0a0b0f" }}>{c}</option>)}
            </select>
          </div>

          {!fixedDex && (
            <select
              value={dex || ""}
              onChange={e => setDex(e.target.value || null)}
              style={{ background: "#111318", border: `1px solid ${C.border}`, borderRadius: 8, color: "#fff", fontSize: 12, padding: "8px 14px", outline: "none", cursor: "pointer", fontWeight: 600 }}>
              <option value="" style={{ background: "#0a0b0f" }}>All Protocols</option>
              {Object.keys(PROTOCOLS).map(k => <option key={k} value={PROTOCOLS[k].id} style={{ background: "#0a0b0f" }}>{PROTOCOLS[k].label}</option>)}
            </select>
          )}

          <div style={{ position: "relative" }}>
            <span style={{ position: "absolute", left: 12, top: 8, fontSize: 12, color: C.muted }}>$</span>
            <input
              type="number"
              placeholder="Min Val"
              value={minUSD || ""}
              onChange={e => setMinUSD(e.target.value ? parseFloat(e.target.value) : null)}
              style={{
                background: "#111318", border: `1px solid ${C.border}`, borderRadius: 8,
                color: "#fff", fontSize: 12, padding: "8px 14px 8px 24px", outline: "none", width: 110, fontWeight: 600
              }}
            />
          </div>
        </div>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 800 }}>
          <thead>
            <tr>
              {["Chain", "Dex", "Pair", "Age", "Amount USD", "In / Out", "Tx Hash"].map(h => (
                <th key={h} style={{ textAlign: "left", fontSize: 13, color: "#FFFFFF", fontWeight: 700, paddingBottom: 18, borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap", paddingRight: 24 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(swaps || []).map((s, i) => {
              const explorerUrl = (EXPLORERS[s.chain] || "https://etherscan.io/tx/") + s.tx_hash;
              return (
                <tr key={i} onClick={() => setSelectedSwap(s)} style={{ transition: "background 0.2s", cursor: "pointer" }} onMouseEnter={e => e.currentTarget.style.background = "#ffffff05"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <td style={{ padding: "16px 24px 16px 0", borderBottom: `0.5px solid ${C.border}`, fontSize: 14, color: "#fff", fontWeight: 500 }}>{s.chain}</td>
                  <td style={{ paddingRight: 24, borderBottom: `0.5px solid ${C.border}` }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <ProtoDot proto={s.dex} />
                      <span style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>{s.dex}</span>
                    </div>
                  </td>
                  <td style={{ paddingRight: 24, borderBottom: `0.5px solid ${C.border}`, fontSize: 14, fontWeight: 700, color: "#fff" }}>{s.token_bought}/{s.token_sold}</td>
                  <td style={{ paddingRight: 24, borderBottom: `0.5px solid ${C.border}`, fontSize: 13, color: C.muted }}>{getAge(s.timestamp)}</td>
                  <td style={{ paddingRight: 24, borderBottom: `0.5px solid ${C.border}`, fontSize: 14, fontWeight: 800, color: "#fff" }}>{fmt(s.amount_usd)}</td>
                  <td style={{ paddingRight: 24, borderBottom: `0.5px solid ${C.border}`, fontSize: 13, fontWeight: 600 }}>
                    <span style={{ color: "rgba(74, 222, 128, 0.85)" }}>{Math.abs(s.amount_bought).toFixed(1)} {s.token_bought}</span>
                    <span style={{ color: C.muted, margin: "0 6px" }}>/</span>
                    <span style={{ color: "rgba(248, 113, 113, 0.85)" }}>{Math.abs(s.amount_sold).toFixed(1)} {s.token_sold}</span>
                  </td>
                  <td style={{ borderBottom: `0.5px solid ${C.border}` }} onClick={e => e.stopPropagation()}>
                    <a href={explorerUrl} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: 8, color: C.uni, fontSize: 13, textDecoration: "none", fontFamily: "monospace", opacity: 0.8 }} onMouseEnter={e => e.currentTarget.style.opacity = 1} onMouseLeave={e => e.currentTarget.style.opacity = 0.8}>
                      {s.tx_hash.slice(0, 10)}...
                      <ExternalLink size={13} />
                    </a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
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
export default function App() {
  const [view, setView] = useState("overview");
  const [summary, setSummary] = useState(null);
  const [volumeData, setVolumeData] = useState([]);
  const [recentSwaps, setRecentSwaps] = useState([]);
  const [protoAnalytics, setProtoAnalytics] = useState({});

  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [loading, setLoading] = useState(false);
  const [protoLoading, setProtoLoading] = useState(false);

  // Search State
  const [searchVal, setSearchVal] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [showModal, setShowModal] = useState(false);

  // Swap Table Filter States
  const [swapChain, setSwapChain] = useState(null);
  const [swapDex, setSwapDex] = useState(null);
  const [swapMinUSD, setSwapMinUSD] = useState(null);
  const [selectedSwap, setSelectedSwap] = useState(null);

  // 1. Fetch search results
  useEffect(() => {
    if (searchVal.length < 2) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    const timer = setTimeout(() => {
      setIsSearching(true);
      axios.get(`/api/v1/search/?q=${searchVal}`)
        .then(res => {
          setSearchResults(res.data.results || []);
          setShowResults(true);
          setIsSearching(false);
        })
        .catch(() => setIsSearching(false));
    }, 400);

    return () => clearTimeout(timer);
  }, [searchVal]);

  const handleSearchResultClick = (item) => {
    setShowResults(false);
    setSearchVal("");

    if (item.type === "transaction") {
      setSelectedSwap({
        tx_hash: item.id,
        chain: item.sublabel,
        dex: item.label.split(" ")[0],
        amount_usd: item.value,
        timestamp: new Date().getTime() / 1000 // approximation
      });
    } else if (item.type === "token") {
      alert(`Filtering for token: ${item.label}`);
    } else if (item.type === "pool") {
      alert(`Viewing pool: ${item.label}`);
    }
  };

  // 2. Fetch ecosystem overview summary
  useEffect(() => {
    axios.get("/api/v1/stats/overview/summary").then(res => setSummary(res.data));
  }, []);

  useEffect(() => {
    setLoading(true);
    let url = `/api/v1/stats/overview/analytics?year=${selectedYear}`;
    if (selectedMonth) url += `&month=${selectedMonth}`;
    axios.get(url).then(res => {
      setVolumeData(res.data.volume_over_time);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [selectedYear, selectedMonth]);

  useEffect(() => {
    let url = `/api/v1/swaps/list?limit=15`;
    if (swapChain) url += `&chain_name=${swapChain}`;
    const activeDex = view === "overview" ? swapDex : PROTOCOLS[view].id;
    if (activeDex) url += `&dex=${activeDex}`;
    if (swapMinUSD) url += `&min_usd=${swapMinUSD}`;
    axios.get(url).then(res => setRecentSwaps(res.data));
  }, [view, swapChain, swapDex, swapMinUSD]);

  useEffect(() => {
    if (view !== "overview") {
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
        <aside style={{
          width: 220, minWidth: 220, background: C.surface,
          borderRight: `1px solid ${C.border}`,
          display: "flex", flexDirection: "column",
          height: "100%",
        }}>
          <div style={{ padding: "26px 20px", borderBottom: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#fff", letterSpacing: "-0.04em", display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 26, height: 26, background: C.uni, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <TrendingUp size={16} color="white" />
              </div>
              TradesLens
            </div>
          </div>
          <nav style={{ padding: "24px 12px", flex: 1 }}>
            <button onClick={() => setView("overview")}
              style={{
                display: "flex", alignItems: "center", gap: 12, width: "100%", background: view === "overview" ? "#ffffff10" : "transparent",
                border: view === "overview" ? `1px solid ${C.borderHi}` : "1px solid transparent",
                borderRadius: 10, padding: "12px 14px", cursor: "pointer", color: view === "overview" ? "#fff" : C.muted,
                fontSize: 14, fontFamily: "inherit", marginBottom: 20, transition: "all 0.25s ease", fontWeight: view === "overview" ? 600 : 500
              }}>
              <BarChart3 size={18} strokeWidth={view === "overview" ? 2.5 : 2} color={view === "overview" ? C.uni : C.dim} />
              Overview
            </button>

            <div style={{ fontSize: 10, color: C.dim, letterSpacing: ".08em", textTransform: "uppercase", padding: "4px 12px 10px", fontWeight: 700, opacity: 0.8 }}>Protocols</div>
            {NAV.filter(n => n.id !== "overview").map(item => {
              const active = view === item.id;
              const Icon = item.icon;
              return (
                <button key={item.id} onClick={() => setView(item.id)}
                  style={{
                    display: "flex", alignItems: "center", gap: 12, width: "100%", background: active ? "#ffffff10" : "transparent",
                    border: active ? `1px solid ${C.borderHi}` : "1px solid transparent",
                    borderRadius: 10, padding: "12px 14px", cursor: "pointer", color: active ? "#fff" : C.muted,
                    fontSize: 14, fontFamily: "inherit", marginBottom: 6, transition: "all 0.15s ease", fontWeight: active ? 600 : 500
                  }}>
                  <Icon size={18} strokeWidth={active ? 2.5 : 2} color={active ? (item.color || C.uni) : C.dim} />
                  {item.label}
                </button>
              );
            })}

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
          </nav>

          <div style={{ padding: "20px", borderTop: `1px solid ${C.border}`, display: "flex", justifyContent: "center", gap: 16 }}>
            <a href="https://github.com/Freemandaily/TradesLens" target="_blank" rel="noreferrer" title="Github" style={{ color: C.dim, transition: "color 0.2s" }} onMouseEnter={e => e.currentTarget.style.color = "#fff"} onMouseLeave={e => e.currentTarget.style.color = C.dim}><Github size={16} /></a>
            <a href="https://twitter.com/freemandayly" target="_blank" rel="noreferrer" title="Twitter" style={{ color: C.dim, transition: "color 0.2s" }} onMouseEnter={e => e.currentTarget.style.color = "#1DA1F2"} onMouseLeave={e => e.currentTarget.style.color = C.dim}><Twitter size={16} /></a>
            <a href="https://t.me/freemanonah" target="_blank" rel="noreferrer" title="Telegram" style={{ color: C.dim, transition: "color 0.2s" }} onMouseEnter={e => e.currentTarget.style.color = "#24A1DE"} onMouseLeave={e => e.currentTarget.style.color = C.dim}><Send size={16} /></a>
            <a href="https://www.linkedin.com/in/onah-innocent-69ba32112/" target="_blank" rel="noreferrer" title="LinkedIn" style={{ color: C.dim, transition: "color 0.2s" }} onMouseEnter={e => e.currentTarget.style.color = "#0077b5"} onMouseLeave={e => e.currentTarget.style.color = C.dim}><Linkedin size={16} /></a>
          </div>
        </aside>

        <main style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, background: "#000000", overflow: "hidden" }}>
          <header style={{
            padding: "20px 32px", borderBottom: `1px solid ${C.border}`,
            display: "flex", alignItems: "center", justifyContent: "space-between",
            background: "#000000", position: "sticky", top: 0, zIndex: 10,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 16, fontWeight: 800, color: "#fff" }}>
                {isProto ? PROTOCOLS[view].label : "Ecosystem Overview"}
              </span>
            </div>
            <div style={{ position: "relative" }}>
              <Search size={16} style={{ position: "absolute", left: 12, top: 11, color: isSearching ? C.uni : C.dim }} className={isSearching ? "animate-pulse" : ""} />
              <input
                type="text"
                placeholder="Search hash, pool, token..."
                value={searchVal}
                onChange={e => setSearchVal(e.target.value)}
                onKeyDown={e => e.key === "Enter" && setShowModal(true)}
                onFocus={() => searchResults.length > 0 && setShowResults(true)}
                style={{
                  background: "#0a0b0f", border: `2px solid ${showResults ? C.borderHi : C.border}`, borderRadius: 10,
                  padding: "10px 14px 10px 38px", fontSize: 14, color: "#fff", width: 320, outline: "none",
                  transition: "all 0.2s"
                }}
              />

              {showResults && searchResults.length > 0 && (
                <div style={{
                  position: "absolute", top: "calc(100% + 8px)", right: 0, width: 360,
                  background: "rgba(10, 11, 15, 0.95)", backdropFilter: "blur(20px)",
                  border: `1px solid ${C.borderHi}`, borderRadius: 12, overflow: "hidden",
                  boxShadow: "0 20px 40px rgba(0,0,0,0.8)", zIndex: 100
                }}>
                  <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.border}`, fontSize: 11, color: C.dim, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Search Results
                  </div>
                  <div style={{ maxHeight: 400, overflowY: "auto" }}>
                    {searchResults.map((item, i) => (
                      <div
                        key={i}
                        onClick={() => handleSearchResultClick(item)}
                        style={{
                          padding: "12px 16px", cursor: "pointer", borderBottom: i < searchResults.length - 1 ? `1px solid ${C.border}` : "none",
                          transition: "background 0.2s", display: "flex", alignItems: "center", gap: 12
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
                        onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                      >
                        <div style={{ width: 32, height: 32, borderRadius: 8, background: "#ffffff08", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          {item.type === "transaction" ? <Hash size={14} color={C.uni} /> : item.type === "pool" ? <Layers size={14} color={C.solid} /> : <Coins size={14} color={C.green} />}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.label}</div>
                          <div style={{ fontSize: 11, color: C.dim, marginTop: 2 }}>{item.sublabel} • {item.type.toUpperCase()}</div>
                        </div>
                        {item.value > 0 && (
                          <div style={{ fontSize: 12, fontWeight: 700, color: C.uni }}>${(item.value / 1e3).toFixed(1)}k</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </header>

          <div style={{ padding: "32px", flex: 1, overflowY: "auto" }}>
            {view === "overview" ? (
              <Overview
                summary={summary}
                volumeData={volumeData}
                year={selectedYear} setYear={setSelectedYear}
                month={selectedMonth} setMonth={setSelectedMonth}
                loading={loading}
              />
            ) : (
              <ProtocolView
                proto={view}
                analytics={protoAnalytics[view]}
                year={selectedYear} setYear={setSelectedYear}
                month={selectedMonth} setMonth={setSelectedMonth}
                loading={protoLoading}
              />
            )}

            <div style={{ marginTop: 32 }}>
              <SwapTable
                swaps={recentSwaps}
                chain={swapChain} setChain={setSwapChain}
                dex={view === "overview" ? swapDex : PROTOCOLS[view].id}
                setDex={setSwapDex}
                minUSD={swapMinUSD} setMinUSD={setSwapMinUSD}
                fixedDex={view === "overview" ? null : PROTOCOLS[view].id}
                title={view === "overview" ? "Live ecosystem feed" : `Live ${PROTOCOLS[view].label} activity`}
              />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

const NAV = [
  { id: "overview", label: "Overview", icon: BarChart3 },
  { id: "uniswap", label: "Uniswap", icon: Layers, color: C.uni },
  { id: "sushiswap", label: "Sushiswap", icon: Activity, color: C.sushi },
  { id: "solidly", label: "Solidly", icon: Activity, color: C.solid },
];
