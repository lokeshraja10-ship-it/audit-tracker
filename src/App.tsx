import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  LayoutDashboard, ClipboardEdit, Settings, ChevronDown, ChevronRight,
  MapPin, Plus, Trash2, Upload, Check, Clock, AlertTriangle, X,
  FileStack, Users, UserSquare2, Save, Loader2, Download, TrendingUp, LogOut, ShieldAlert
} from "lucide-react";
import {
  PieChart, Pie, Cell, ResponsiveContainer, RadialBarChart, RadialBar,
  PolarAngleAxis, BarChart, Bar, XAxis, YAxis, Tooltip,
} from "recharts";
import { auth, signIn, logOut, watchAuth, watchState, saveState } from "./firebase";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/* ============================================================
   DESIGN TOKENS — BPCL brand palette
   #007BC9 BPCL Blue (primary/interactive) · #00456E deep blue (ink/nav)
   #FFE000 BPCL Gold (fills/accents) · #8A6A00 readable dark-gold (text)
   #4C8577 teal (on-track/complete) · #B0483F brick (overdue/danger)
   #EEF5FB paper (bg, blue-tinted) · #1C2733 ink (text)
   Display: Fraunces (serif, ledger headers) · Body/UI: IBM Plex Sans
   Data/dates: IBM Plex Mono (tabular, stamped-ledger numerals)
   ============================================================ */

const FONT_LINK = "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap";

// Paste a hosted URL to the official BPCL logo image here (e.g. from your company's
// media kit, uploaded to your own image host / GitHub repo). Leave blank to show the
// brand-coloured "BP" placeholder mark instead.
const LOGO_URL = "";

const UNITS = [
  { id: "SR", name: "Southern Region" },
  { id: "NR", name: "Northern Region" },
  { id: "WR", name: "Western Region" },
  { id: "ER", name: "Eastern Region" },
  { id: "HQ", name: "Corporate Office" },
  { id: "REF", name: "Refineries" },
];

const STAGES = [
  { key: "noteIssueDate", label: "Audit Note Issued", short: "Note" },
  { key: "locationVisit", label: "Location Visit(s)", short: "Visit" },
  { key: "preDraftDate", label: "Pre-Draft Report", short: "Pre-Draft" },
  { key: "darDiscussionDate", label: "DAR Discussion", short: "DAR Disc." },
  { key: "darIssueDate", label: "DAR Issued", short: "DAR Issued" },
  { key: "finalPublishDate", label: "Final Report Published", short: "Published" },
];

const LOCATION_TYPES = ["Regional Office", "Terminal", "Depot", "Retail Outlet", "LPG Plant", "Refinery Site", "Vendor / Third-Party", "Other"];

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

function fmtDate(d) {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt)) return "—";
  return dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function daysBetween(a, b) {
  const A = new Date(a), B = new Date(b);
  if (isNaN(A) || isNaN(B)) return null;
  return Math.round((B - A) / 86400000);
}

// Indian FY quarter for a date: Apr-Jun=Q1, Jul-Sep=Q2, Oct-Dec=Q3, Jan-Mar=Q4
function fyQuarterInfo(date) {
  const d = new Date(date);
  const m = d.getMonth(); // 0-11
  const y = d.getFullYear();
  let fyStartYear = m >= 3 ? y : y - 1; // FY starts April
  const q = m >= 3 && m <= 5 ? 1 : m >= 6 && m <= 8 ? 2 : m >= 9 && m <= 11 ? 3 : 4;
  return { fyLabel: `FY${String(fyStartYear + 1).slice(-2)}`, fyStartYear, q };
}

function currentAuditStage(audit) {
  // returns index into STAGES of furthest completed stage, -1 if not started
  let idx = -1;
  if (audit.noteIssueDate) idx = 0;
  if (audit.locationVisits && audit.locationVisits.length > 0) idx = Math.max(idx, 1);
  if (audit.preDraftDate) idx = Math.max(idx, 2);
  if (audit.darDiscussionDate) idx = Math.max(idx, 3);
  if (audit.darIssueDate) idx = Math.max(idx, 4);
  if (audit.finalPublishDate) idx = Math.max(idx, 5);
  return idx;
}

function isComplete(audit) { return !!audit.finalPublishDate; }

function generatePdfReport(state) {
  const { audits, auditors } = state;
  const total = audits.length;
  const completed = audits.filter(isComplete).length;
  const notStarted = audits.filter(a => currentAuditStage(a) === -1).length;
  const ongoing = total - completed - notStarted;
  const now = new Date();

  const doc = new jsPDF();
  const NAVY_RGB = [0, 69, 110];

  doc.setFontSize(18);
  doc.setTextColor(0);
  doc.text("Internal Audit — Status Report", 14, 18);
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Generated ${now.toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })}`, 14, 25);

  doc.setFontSize(11);
  doc.setTextColor(0);
  doc.text(`Total: ${total}   Completed: ${completed}   In Progress: ${ongoing}   Not Started: ${notStarted}`, 14, 34);

  const unitRows = UNITS.map(u => {
    const ua = audits.filter(a => a.unit === u.id);
    const uc = ua.filter(isComplete).length;
    const uns = ua.filter(a => currentAuditStage(a) === -1).length;
    const active = ua.length - uc - uns;
    const done = ua.filter(a => isComplete(a) && a.noteIssueDate);
    const avg = done.length ? Math.round(done.reduce((s, a) => s + daysBetween(a.noteIssueDate, a.finalPublishDate), 0) / done.length) : null;
    return [`${u.id} — ${u.name}`, ua.length, uc, active, uns, ua.length ? `${Math.round((uc / ua.length) * 100)}%` : "—", avg !== null ? `${avg}d` : "—"];
  });
  autoTable(doc, {
    startY: 40,
    head: [["Unit", "Total", "Completed", "Active", "Not Started", "% Complete", "Avg Days"]],
    body: unitRows,
    headStyles: { fillColor: NAVY_RGB },
    styles: { fontSize: 9 },
  });

  const { fyLabel, fyStartYear, q: currentQ } = fyQuarterInfo(now);
  const fyStart = new Date(fyStartYear, 3, 1), fyEnd = new Date(fyStartYear + 1, 2, 31);
  const fyAudits = audits.filter(a => { const ref = new Date(a.noteIssueDate || a.createdAt || now); return ref >= fyStart && ref <= fyEnd; });
  const totalPlanned = fyAudits.length || total;
  const quarterEnds = [new Date(fyStartYear, 5, 30), new Date(fyStartYear, 8, 30), new Date(fyStartYear, 11, 31), new Date(fyStartYear + 1, 2, 31)];
  const pool = fyAudits.length ? fyAudits : audits;
  const qRows = ["Q1", "Q2", "Q3", "Q4"].map((label, i) => {
    const targetPct = (i + 1) * 25;
    const actualCount = pool.filter(a => a.finalPublishDate && new Date(a.finalPublishDate) <= quarterEnds[i]).length;
    const actualPct = totalPlanned > 0 ? Math.round((actualCount / totalPlanned) * 100) : 0;
    const isFuture = (i + 1) > currentQ;
    const status = isFuture ? "Upcoming" : (actualPct >= targetPct ? "On track" : "Behind");
    return [label, `${targetPct}%`, `${actualPct}%`, actualCount, status];
  });
  doc.setFontSize(12);
  doc.text(`Target vs Actual — ${fyLabel}`, 14, doc.lastAutoTable.finalY + 10);
  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 14,
    head: [["Quarter", "Target %", "Actual %", "Closed", "Status"]],
    body: qRows,
    headStyles: { fillColor: NAVY_RGB },
    styles: { fontSize: 9 },
  });

  if (auditors.length) {
    const auditorRows = auditors.map(name => {
      const mine = audits.filter(a => a.auditor === name);
      const c = mine.filter(isComplete).length;
      return [name, mine.length, c, mine.length ? `${Math.round((c / mine.length) * 100)}%` : "—"];
    });
    doc.text("Auditor Performance", 14, doc.lastAutoTable.finalY + 10);
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 14,
      head: [["Auditor", "Assigned", "Completed", "% Complete"]],
      body: auditorRows,
      headStyles: { fillColor: NAVY_RGB },
      styles: { fontSize: 9 },
    });
  }

  if (audits.length) {
    const auditRows = audits.map(a => {
      const idx = currentAuditStage(a);
      const stageLabel = idx === -1 ? "Not Started" : STAGES[idx].label;
      return [a.unit, a.name, a.auditor || "—", a.po || "—", stageLabel, fmtDate(a.noteIssueDate), fmtDate(a.finalPublishDate)];
    });
    doc.text("All Audits", 14, doc.lastAutoTable.finalY + 10);
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 14,
      head: [["Unit", "Audit", "Auditor", "PO", "Stage", "Note Issued", "Published"]],
      body: auditRows,
      headStyles: { fillColor: NAVY_RGB },
      styles: { fontSize: 8 },
    });
  }

  doc.save(`Audit-Status-Report-${now.toISOString().slice(0, 10)}.pdf`);
}

function DownloadPdfButton({ state }) {
  return (
    <button onClick={() => generatePdfReport(state)} style={styles.shareBtn}>
      <Download size={13} /> Download PDF
    </button>
  );
}

const DEFAULT_STATE = { audits: [], auditors: [], pos: [] };

/* ============================================================
   AUTH GATE
   ============================================================ */
function AuthGate({ children }) {
  const [user, setUser] = useState(undefined); // undefined = checking, null = signed out
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [password, setPassword] = useState("");

  useEffect(() => watchAuth(setUser), []);

  const handleSignIn = async (e) => {
    e.preventDefault();
    setError(""); setBusy(true);
    try { await signIn(password); }
    catch (err) {
      const msg = err.code === "auth/invalid-credential" || err.code === "auth/wrong-password" || err.code === "auth/user-not-found"
        ? "That password isn't recognised."
        : (err.message || "Sign-in failed.");
      setError(msg);
    } finally { setBusy(false); }
  };

  if (user === undefined) {
    return (
      <div style={{ minHeight: "100vh", background: "#EEF5FB", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Loader2 className="spin" size={28} color="#007BC9" />
        <style>{`.spin{animation:spin 0.9s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ minHeight: "100vh", background: "#EEF5FB", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'IBM Plex Sans', sans-serif" }}>
        <form onSubmit={handleSignIn} style={{ textAlign: "center", maxWidth: 320, width: "100%", padding: "0 20px" }}>
          <div style={{ width: 48, height: 48, borderRadius: 10, background: "#FFE000", color: "#00456E", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: 16, margin: "0 auto 16px" }}>BP</div>
          <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 22, color: "#00456E", margin: "0 0 8px" }}>Audit Tracker</h1>
          <p style={{ color: "#5A6478", fontSize: 13.5, marginBottom: 20 }}>Enter the team password to continue.</p>
          <input
            type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" autoFocus
            style={{ width: "100%", padding: "11px 14px", borderRadius: 8, border: "1px solid #D6DAE2", fontSize: 14, marginBottom: 14, textAlign: "center" }}
          />
          <button type="submit" disabled={busy || !password} style={{ width: "100%", background: "#00456E", color: "#fff", border: "none", borderRadius: 8, padding: "11px 20px", fontSize: 14, fontWeight: 600, cursor: busy ? "default" : "pointer", opacity: busy ? 0.7 : 1 }}>
            {busy ? "Checking…" : "Continue"}
          </button>
          {error && (
            <div style={{ marginTop: 14, color: "#B0483F", fontSize: 12.5, display: "flex", alignItems: "center", gap: 6, justifyContent: "center" }}>
              <ShieldAlert size={14} /> {error}
            </div>
          )}
          <p style={{ marginTop: 18, fontSize: 11.5, color: "#A3ABBB" }}>Don't have the password? Ask your admin.</p>
        </form>
      </div>
    );
  }

  return children(user);
}


/* ============================================================
   ROOT APP
   ============================================================ */
export default function App() {
  return <AuthGate>{(user) => <AuthedApp user={user} />}</AuthGate>;
}

function AuthedApp({ user }) {
  const [screen, setScreen] = useState("dashboard");
  const [state, setState] = useState(DEFAULT_STATE);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState("idle"); // idle | saving | saved | error

  useEffect(() => {
    document.title = "Audit Tracker";
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = FONT_LINK;
    document.head.appendChild(link);
    const unsub = watchState((s) => { setState(s); setLoading(false); });
    return unsub;
  }, []);

  const persist = useCallback(async (next) => {
    setState(next);
    setSaveStatus("saving");
    try { await saveState(next); setSaveStatus("saved"); }
    catch (e) { console.error(e); setSaveStatus("error"); }
    setTimeout(() => setSaveStatus("idle"), 1500);
  }, []);

  const updateAudit = useCallback((auditId, patch) => {
    setState((prev) => {
      const next = { ...prev, audits: prev.audits.map(a => a.id === auditId ? { ...a, ...patch } : a) };
      (async () => {
        setSaveStatus("saving");
        try { await saveState(next); setSaveStatus("saved"); }
        catch (e) { console.error(e); setSaveStatus("error"); }
        setTimeout(() => setSaveStatus("idle"), 1500);
      })();
      return next;
    });
  }, []);

  if (loading) {
    return (
      <div style={{ ...styles.appShell, alignItems: "center", justifyContent: "center", display: "flex" }}>
        <Loader2 className="spin" size={28} color="#007BC9" />
        <style>{spinCss}</style>
      </div>
    );
  }

  return (
    <div style={styles.appShell}>
      <style>{globalCss}</style>
      <div className="app-screen-only">
        <TopNav screen={screen} setScreen={setScreen} saveStatus={saveStatus} user={user} />
        <main style={styles.main}>
          {screen === "dashboard" && <Dashboard state={state} />}
          {screen === "update" && <UpdateScreen state={state} updateAudit={updateAudit} />}
          {screen === "performance" && <AuditorPerformance state={state} />}
          {screen === "admin" && <AdminScreen state={state} persist={persist} />}
        </main>
      </div>
      <div className="print-report-only">
        <PrintReport state={state} />
      </div>
    </div>
  );
}

const spinCss = `.spin{animation:spin 0.9s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}`;

const globalCss = `
  * { box-sizing: border-box; }
  body, html { margin:0; padding:0; }
  ::selection { background:#007BC933; }
  input, select, button, textarea { font-family: inherit; }
  input[type=date]::-webkit-calendar-picker-indicator { filter: invert(30%) sepia(20%) saturate(500%) hue-rotate(175deg); cursor:pointer; }
  .card-hover { transition: box-shadow .18s ease; }
  @media (hover: hover) and (pointer: fine) {
    .card-hover:hover { box-shadow: 0 4px 18px rgba(16,35,63,0.10); transform: translateY(-1px); }
  }
  button { touch-action: manipulation; }
  .fade-row { animation: fadeIn .25s ease; }
  @keyframes fadeIn { from { opacity:0; transform:translateY(3px);} to {opacity:1; transform:translateY(0);} }
  ::-webkit-scrollbar { height:8px; width:8px; }
  ::-webkit-scrollbar-thumb { background:#C7CEDA; border-radius:8px; }
  .print-report-only { display: none; }
  @media print {
    .app-screen-only { display: none !important; }
    .print-report-only { display: block !important; }
  }
`;

/* ============================================================
   NAV
   ============================================================ */
function TopNav({ screen, setScreen, saveStatus, user }) {
  const items = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "update", label: "Update Audit", icon: ClipboardEdit },
    { id: "performance", label: "Performance", icon: TrendingUp },
    { id: "admin", label: "Setup", icon: Settings },
  ];
  return (
    <header style={styles.nav}>
      <div style={styles.navBrand}>
        {LOGO_URL ? (
          <img src={LOGO_URL} alt="BPCL" style={styles.navLogoImg} />
        ) : (
          <div style={styles.navMark}>BP</div>
        )}
        <div>
          <div style={styles.navTitle}>Audit Tracker</div>
          <div style={styles.navSub}>Internal Audit Department · Bharat Petroleum</div>
        </div>
      </div>
      <nav style={styles.navTabs}>
        {items.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setScreen(id)}
            style={{ ...styles.navTab, ...(screen === id ? styles.navTabActive : {}) }}
          >
            <Icon size={15} strokeWidth={2.2} />
            {label}
          </button>
        ))}
      </nav>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div style={styles.saveIndicator}>
          {saveStatus === "saving" && <><Loader2 className="spin" size={13} /> Saving…</>}
          {saveStatus === "saved" && <><Check size={13} color="#4C8577" /> Saved</>}
          {saveStatus === "error" && <span style={{ color: "#B0483F" }}>Save failed</span>}
          {saveStatus === "idle" && <span style={{ opacity: 0.45 }}>Synced</span>}
        </div>
        {user && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#9FB0C7", fontSize: 12 }}>
            <span>{user.email}</span>
            <button onClick={logOut} style={{ background: "transparent", border: "none", color: "#9FB0C7", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
              <LogOut size={13} />
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

/* ============================================================
   DASHBOARD
   ============================================================ */
function Dashboard({ state }) {
  const { audits } = state;
  const [openUnitId, setOpenUnitId] = useState(null);
  const detailRef = useRef(null);
  const total = audits.length;
  const completed = audits.filter(isComplete).length;
  const notStarted = audits.filter(a => currentAuditStage(a) === -1).length;
  const ongoing = total - completed - notStarted;

  const overdueThresholdDays = 90; // ongoing audit open longer than this = flagged
  const overdue = audits.filter(a => {
    if (isComplete(a) || !a.noteIssueDate) return false;
    return daysBetween(a.noteIssueDate, new Date()) > overdueThresholdDays;
  }).length;

  const avgCompletedDays = useMemo(() => {
    const done = audits.filter(a => isComplete(a) && a.noteIssueDate);
    if (!done.length) return null;
    const sum = done.reduce((s, a) => s + daysBetween(a.noteIssueDate, a.finalPublishDate), 0);
    return Math.round(sum / done.length);
  }, [audits]);

  useEffect(() => {
    if (openUnitId && detailRef.current) {
      detailRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [openUnitId]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <div>
        <div style={styles.eyebrow}>Overview — All Regions</div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
          <h1 style={styles.h1}>Audit Status Ledger</h1>
          <DownloadPdfButton state={state} />
        </div>
        <p style={styles.leadText}>
          {total} audits on record across six units · {completed} closed · {ongoing} in progress
          {overdue > 0 && <> · <span style={{ color: "#B0483F", fontWeight: 600 }}>{overdue} flagged past {overdueThresholdDays} days</span></>}
        </p>
      </div>

      <StatusDonut total={total} completed={completed} ongoing={ongoing} notStarted={notStarted} />

      <div style={styles.statRow}>
        <StatTile label="Total Audits" value={total} icon={FileStack} />
        <StatTile label="Completed" value={completed} icon={Check} accent="#4C8577" />
        <StatTile label="In Progress" value={ongoing} icon={Clock} accent="#007BC9" />
        <StatTile label="Not Started" value={notStarted} icon={AlertTriangle} accent="#8A93A6" />
        <StatTile
          label="Avg. Turnaround"
          value={avgCompletedDays !== null ? `${avgCompletedDays}d` : "—"}
          icon={Clock}
          accent="#8A6A00"
          sub="note → publish, closed audits"
        />
      </div>

      <QuarterlyTarget audits={audits} />

      <div>
        <div style={styles.sectionHeader}>Unit-wise Status <span style={{ fontWeight: 400, color: "#8A93A6", fontSize: 12.5 }}>— tap a card for details</span></div>
        <div style={styles.unitGrid}>
          {UNITS.map(u => <UnitCard key={u.id} unit={u} audits={audits.filter(a => a.unit === u.id)} onOpen={() => setOpenUnitId(u.id === openUnitId ? null : u.id)} />)}
        </div>
      </div>

      {openUnitId && (
        <div ref={detailRef}>
          <UnitDetailPanel
            unit={UNITS.find(u => u.id === openUnitId)}
            audits={audits.filter(a => a.unit === openUnitId)}
            onClose={() => setOpenUnitId(null)}
            overdueThresholdDays={overdueThresholdDays}
          />
        </div>
      )}

      <OverdueTable audits={audits} overdueThresholdDays={overdueThresholdDays} />
    </div>
  );
}

function StatTile({ label, value, icon: Icon, accent = "#00456E", sub }) {
  return (
    <div style={styles.statTile} className="card-hover">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={styles.statLabel}>{label}</span>
        <Icon size={15} color={accent} strokeWidth={2.2} />
      </div>
      <div style={{ ...styles.statValue, color: accent === "#00456E" ? "#00456E" : accent }}>{value}</div>
      {sub && <div style={styles.statSub}>{sub}</div>}
    </div>
  );
}

function StatusDonut({ total, completed, ongoing, notStarted }) {
  const segments = [
    { name: "Completed", value: completed, color: "#4C8577" },
    { name: "In Progress", value: ongoing, color: "#007BC9" },
    { name: "Not Started", value: notStarted, color: "#C7CEDA" },
  ];
  const hasData = total > 0;
  const chartData = hasData ? segments.filter(s => s.value > 0) : [{ name: "No data", value: 1, color: "#EEF5FB" }];

  return (
    <div style={styles.donutCard} className="card-hover">
      <div style={styles.donutChartWrap}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={chartData} dataKey="value" nameKey="name" innerRadius="68%" outerRadius="98%" paddingAngle={hasData ? 3 : 0} stroke="none" isAnimationActive={false}>
              {chartData.map((seg, i) => <Cell key={i} fill={seg.color} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div style={styles.donutCenter}>
          <div style={styles.donutCenterValue}>{total}</div>
          <div style={styles.donutCenterLabel}>audits</div>
        </div>
      </div>
      <div style={styles.donutLegend}>
        <div style={styles.donutLegendTitle}>Status at a Glance</div>
        {segments.map(s => <DonutLegendRow key={s.name} color={s.color} label={s.name} value={s.value} total={total} />)}
      </div>
    </div>
  );
}

function DonutLegendRow({ color, label, value, total }) {
  const pct = total ? Math.round((value / total) * 100) : 0;
  return (
    <div style={styles.donutLegendRow}>
      <span style={{ width: 10, height: 10, borderRadius: 3, background: color, display: "inline-block", flexShrink: 0 }} />
      <span style={{ flex: 1, color: "#5A6478" }}>{label}</span>
      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, color: "#00456E" }}>{value}</span>
      <span style={{ fontFamily: "'IBM Plex Mono', monospace", color: "#A3ABBB", fontSize: 11, width: 32, textAlign: "right" }}>{pct}%</span>
    </div>
  );
}

function MiniGauge({ pct, color }) {
  const data = [{ value: pct, fill: color }];
  return (
    <div style={styles.miniGauge}>
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart innerRadius="72%" outerRadius="100%" data={data} startAngle={90} endAngle={-270}>
          <PolarAngleAxis type="number" domain={[0, 100]} tick={false} axisLine={false} />
          <RadialBar background={{ fill: "#EFF3F8" }} dataKey="value" cornerRadius={6} isAnimationActive={false} />
        </RadialBarChart>
      </ResponsiveContainer>
      <div style={styles.miniGaugeLabel}>{pct}%</div>
    </div>
  );
}

function QuarterlyTarget({ audits }) {
  const now = new Date();
  const { fyLabel, fyStartYear, q: currentQ } = fyQuarterInfo(now);
  const fyStart = new Date(fyStartYear, 3, 1); // Apr 1
  const fyEnd = new Date(fyStartYear + 1, 2, 31); // Mar 31

  const fyAudits = audits.filter(a => {
    const ref = new Date(a.noteIssueDate || a.createdAt || now);
    return ref >= fyStart && ref <= fyEnd;
  });
  const totalPlanned = fyAudits.length || audits.length; // fallback if FY tagging is sparse

  const quarterEnds = [
    new Date(fyStartYear, 5, 30),   // Q1 end Jun 30
    new Date(fyStartYear, 8, 30),   // Q2 end Sep 30
    new Date(fyStartYear, 11, 31),  // Q3 end Dec 31
    new Date(fyStartYear + 1, 2, 31), // Q4 end Mar 31
  ];

  const pool = fyAudits.length ? fyAudits : audits;
  const actualByQ = quarterEnds.map(end =>
    pool.filter(a => a.finalPublishDate && new Date(a.finalPublishDate) <= end).length
  );

  return (
    <div>
      <div style={styles.sectionHeader}>Target vs Actual Completion — {fyLabel} <span style={{ fontWeight: 400, color: "#8A93A6" }}>(25% cumulative per quarter · {totalPlanned} audits in scope)</span></div>
      <div style={styles.targetCard}>
        <div style={styles.quarterChartWrap}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={["Q1", "Q2", "Q3", "Q4"].map((label, i) => {
              const targetPct = (i + 1) * 25;
              const actualPct = totalPlanned > 0 ? Math.round((actualByQ[i] / totalPlanned) * 100) : 0;
              const isFuture = (i + 1) > currentQ;
              const onTrack = actualPct >= targetPct;
              return { label, target: targetPct, actual: actualPct, fill: isFuture ? "#C7CEDA" : (onTrack ? "#4C8577" : "#B0483F") };
            })} margin={{ top: 6, right: 6, left: -22, bottom: 0 }} barGap={4}>
              <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#5A6478" }} axisLine={{ stroke: "#E2E6ED" }} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10.5, fill: "#A3ABBB" }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
              <Tooltip formatter={(v) => `${v}%`} contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E2E6ED", fontFamily: "IBM Plex Sans" }} />
              <Bar dataKey="target" name="Target" fill="#EBD9B8" radius={[4, 4, 0, 0]} barSize={14} />
              <Bar dataKey="actual" name="Actual" radius={[4, 4, 0, 0]} barSize={14}>
                {["Q1", "Q2", "Q3", "Q4"].map((_, i) => {
                  const targetPct = (i + 1) * 25;
                  const actualPct = totalPlanned > 0 ? Math.round((actualByQ[i] / totalPlanned) * 100) : 0;
                  const isFuture = (i + 1) > currentQ;
                  const onTrack = actualPct >= targetPct;
                  return <Cell key={i} fill={isFuture ? "#C7CEDA" : (onTrack ? "#4C8577" : "#B0483F")} />;
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div style={styles.quarterChartLegend}>
          <LegendDot color="#EBD9B8" label="Target" />
          <LegendDot color="#4C8577" label="Actual — on track" />
          <LegendDot color="#B0483F" label="Actual — behind" />
        </div>
        {["Q1", "Q2", "Q3", "Q4"].map((label, i) => {
          const targetPct = (i + 1) * 25;
          const actualCount = actualByQ[i];
          const actualPct = totalPlanned > 0 ? Math.round((actualCount / totalPlanned) * 100) : 0;
          const isFuture = (i + 1) > currentQ;
          const onTrack = actualPct >= targetPct;
          return (
            <div key={label} style={styles.quarterRow}>
              <div style={styles.quarterLabel}>
                {label}
                {i + 1 === currentQ && <span style={styles.nowPill}>now</span>}
              </div>
              <div style={styles.ruler}>
                <div style={styles.rulerTrack}>
                  <div style={{
                    ...styles.rulerFill,
                    width: `${Math.min(actualPct, 100)}%`,
                    background: isFuture ? "#C7CEDA" : (onTrack ? "#4C8577" : "#B0483F"),
                  }} />
                  <div style={{ ...styles.targetTick, left: `${targetPct}%` }} title={`Target ${targetPct}%`} />
                </div>
              </div>
              <div style={styles.quarterFigures}>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, color: isFuture ? "#8A93A6" : (onTrack ? "#4C8577" : "#B0483F") }}>
                  {actualPct}%
                </span>
                <span style={{ color: "#8A93A6", fontSize: 12 }}> / {targetPct}% target</span>
                <span style={{ color: "#8A93A6", fontSize: 12 }}> · {actualCount} closed</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function UnitCard({ unit, audits, onOpen }) {
  const total = audits.length;
  const completed = audits.filter(isComplete).length;
  const notStarted = audits.filter(a => currentAuditStage(a) === -1).length;
  const active = total - notStarted - completed;

  const avgDays = useMemo(() => {
    const done = audits.filter(a => isComplete(a) && a.noteIssueDate);
    if (!done.length) return null;
    return Math.round(done.reduce((s, a) => s + daysBetween(a.noteIssueDate, a.finalPublishDate), 0) / done.length);
  }, [audits]);

  const pct = total ? Math.round((completed / total) * 100) : 0;

  return (
    <div style={styles.unitCard} className="card-hover">
      <div style={styles.unitCardHead}>
        <div>
          <div style={styles.unitCode}>{unit.id}</div>
          <div style={styles.unitName}>{unit.name}</div>
        </div>
        <MiniGauge pct={pct} color={pct === 100 ? "#4C8577" : "#007BC9"} />
      </div>

      <div style={styles.unitBarTrack}>
        <div style={{ width: `${total ? (completed / total) * 100 : 0}%`, background: "#4C8577" }} />
        <div style={{ width: `${total ? (active / total) * 100 : 0}%`, background: "#007BC9" }} />
        <div style={{ width: `${total ? (notStarted / total) * 100 : 0}%`, background: "#E4E8EE" }} />
      </div>

      <div style={styles.unitLegend}>
        <LegendDot color="#4C8577" label={`${completed} closed`} />
        <LegendDot color="#007BC9" label={`${active} active`} />
        <LegendDot color="#C7CEDA" label={`${notStarted} pending`} />
      </div>

      <div style={styles.unitFoot}>
        <span>{total} total</span>
        <span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{avgDays !== null ? `avg ${avgDays}d` : "no closures yet"}</span>
      </div>
      <button type="button" onClick={onOpen} style={styles.unitTapHint}>
        View details <ChevronRight size={12} />
      </button>
    </div>
  );
}

function UnitDetailPanel({ unit, audits, onClose, overdueThresholdDays }) {
  const total = audits.length;
  const completed = audits.filter(isComplete).length;
  const notStarted = audits.filter(a => currentAuditStage(a) === -1).length;
  const pct = total ? Math.round((completed / total) * 100) : 0;
  const backlog = audits.filter(a => !isComplete(a)).length;
  const overdueCount = audits.filter(a => !isComplete(a) && a.noteIssueDate && daysBetween(a.noteIssueDate, new Date()) > overdueThresholdDays).length;

  const avgDays = useMemo(() => {
    const done = audits.filter(a => isComplete(a) && a.noteIssueDate);
    if (!done.length) return null;
    return Math.round(done.reduce((s, a) => s + daysBetween(a.noteIssueDate, a.finalPublishDate), 0) / done.length);
  }, [audits]);

  const sorted = useMemo(() => [...audits].sort((a, b) => currentAuditStage(a) - currentAuditStage(b)), [audits]);

  return (
    <div style={styles.detailPanel} className="fade-row">
      <div style={styles.detailHead}>
        <div>
          <div style={styles.unitCode}>{unit.id} · Entity-wise Status</div>
          <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 20, color: "#00456E" }}>{unit.name}</div>
        </div>
        <button onClick={onClose} style={styles.iconBtn}><X size={18} color="#5A6478" /></button>
      </div>

      <div style={styles.detailStatRow}>
        <DetailStat label="% Complete" value={`${pct}%`} accent="#00456E" />
        <DetailStat label="Backlog (pending)" value={backlog} accent="#8A6A00" />
        <DetailStat label="Overdue" value={overdueCount} accent="#B0483F" />
        <DetailStat label="Avg Turnaround" value={avgDays !== null ? `${avgDays}d` : "—"} accent="#4C8577" />
      </div>

      <div style={styles.detailListTitle}>Entities / Audits — {total}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {sorted.length === 0 && <div style={styles.emptyNote}>No audits in this unit yet.</div>}
        {sorted.map(a => {
          const stageIdx = currentAuditStage(a);
          const days = a.noteIssueDate ? daysBetween(a.noteIssueDate, isComplete(a) ? a.finalPublishDate : new Date()) : null;
          return (
            <div key={a.id} style={styles.entityRow}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13.5, color: "#00456E" }}>{a.name}</div>
                <div style={{ fontSize: 11.5, color: "#8A93A6", marginTop: 2 }}>
                  {a.auditor || "unassigned"}{a.po ? ` · PO: ${a.po}` : ""}{days !== null ? ` · ${days}d ${isComplete(a) ? "total" : "open"}` : ""}
                </div>
              </div>
              <StageBadge stageIdx={stageIdx} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DetailStat({ label, value, accent }) {
  return (
    <div style={styles.detailStatTile}>
      <div style={styles.detailStatLabel}>{label}</div>
      <div style={{ ...styles.detailStatValue, color: accent }}>{value}</div>
    </div>
  );
}

function LegendDot({ color, label }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, color: "#5A6478" }}>
      <span style={{ width: 7, height: 7, borderRadius: 2, background: color, display: "inline-block" }} />
      {label}
    </div>
  );
}

function OverdueTable({ audits, overdueThresholdDays }) {
  const flagged = audits
    .filter(a => !isComplete(a) && a.noteIssueDate && daysBetween(a.noteIssueDate, new Date()) > overdueThresholdDays)
    .sort((a, b) => daysBetween(b.noteIssueDate, new Date()) - daysBetween(a.noteIssueDate, new Date()));

  if (!flagged.length) return null;

  return (
    <div>
      <div style={styles.sectionHeader}>
        <AlertTriangle size={14} style={{ marginRight: 6, verticalAlign: -2 }} color="#B0483F" />
        Flagged — Open Beyond {overdueThresholdDays} Days
      </div>
      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Audit</th>
              <th style={styles.th}>Unit</th>
              <th style={styles.th}>Auditor</th>
              <th style={styles.th}>Stage</th>
              <th style={styles.th}>Note Issued</th>
              <th style={styles.th}>Days Open</th>
            </tr>
          </thead>
          <tbody>
            {flagged.map(a => (
              <tr key={a.id} className="fade-row">
                <td style={styles.td}>{a.name}</td>
                <td style={styles.td}><UnitTag id={a.unit} /></td>
                <td style={styles.td}>{a.auditor || "—"}</td>
                <td style={styles.td}>{STAGES[currentAuditStage(a)]?.short || "Not started"}</td>
                <td style={{ ...styles.td, fontFamily: "'IBM Plex Mono', monospace" }}>{fmtDate(a.noteIssueDate)}</td>
                <td style={{ ...styles.td, fontFamily: "'IBM Plex Mono', monospace", color: "#B0483F", fontWeight: 600 }}>
                  {daysBetween(a.noteIssueDate, new Date())}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function UnitTag({ id }) {
  return <span style={styles.unitTag}>{id}</span>;
}

/* ============================================================
   UPDATE SCREEN (auditor-facing)
   ============================================================ */
function UpdateScreen({ state, updateAudit }) {
  const [me, setMe] = useState(null);
  const [checkingIdentity, setCheckingIdentity] = useState(true);
  const [pendingName, setPendingName] = useState("");
  const [auditId, setAuditId] = useState("");

  useEffect(() => {
    const stored = localStorage.getItem("auditor-identity");
    if (stored) setMe(stored);
    setCheckingIdentity(false);
  }, []);

  const chooseIdentity = (name) => {
    setMe(name);
    localStorage.setItem("auditor-identity", name);
  };
  const switchIdentity = () => {
    setMe(null);
    setAuditId("");
    localStorage.removeItem("auditor-identity");
  };

  const myAudits = useMemo(
    () => state.audits.filter(a => a.auditor === me).sort((a, b) => a.unit.localeCompare(b.unit)),
    [state.audits, me]
  );
  const audit = state.audits.find(a => a.id === auditId);

  if (checkingIdentity) {
    return <div style={{ padding: 40, textAlign: "center", color: "#8A93A6" }}><Loader2 className="spin" size={20} /></div>;
  }

  if (!me) {
    return (
      <div style={{ maxWidth: 420 }}>
        <div style={styles.eyebrow}>Auditor Workspace</div>
        <h1 style={styles.h1}>Who are you?</h1>
        <p style={styles.leadText}>Pick your name — you'll only see and update audits assigned to you. This is remembered on this device.</p>
        <div style={{ marginTop: 18 }}>
          <Field label="Your name">
            <select value={pendingName} onChange={e => setPendingName(e.target.value)} style={styles.select}>
              <option value="">Select your name…</option>
              {state.auditors.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </Field>
          <button
            onClick={() => pendingName && chooseIdentity(pendingName)}
            disabled={!pendingName}
            style={{ ...styles.primaryBtnSm, marginTop: 12, opacity: pendingName ? 1 : 0.5, cursor: pendingName ? "pointer" : "default" }}
          >
            Continue
          </button>
          {state.auditors.length === 0 && (
            <p style={{ ...styles.emptyNote, marginTop: 12 }}>No auditors set up yet — ask your admin to add names under Setup → Auditors.</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 780 }}>
      <div>
        <div style={styles.eyebrow}>Auditor Workspace</div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <h1 style={styles.h1}>Signed in as {me}</h1>
          <button onClick={switchIdentity} style={styles.linkBtn}>Not you? Switch</button>
        </div>
        <p style={styles.leadText}>You can only update audits assigned to you. Changes save automatically.</p>
      </div>

      <Field label="Your assigned audits">
        <select value={auditId} onChange={e => setAuditId(e.target.value)} style={styles.select} disabled={!myAudits.length}>
          <option value="">{myAudits.length ? "Select an audit…" : "No audits assigned to you yet"}</option>
          {myAudits.map(a => <option key={a.id} value={a.id}>{a.unit} — {a.name}</option>)}
        </select>
      </Field>

      {myAudits.length === 0 && (
        <p style={styles.emptyNote}>Ask your admin to assign audits to you under Setup → Audits.</p>
      )}

      {audit && <AuditEditor key={audit.id} audit={audit} state={state} updateAudit={updateAudit} />}
    </div>
  );
}

function AuditEditor({ audit, state, updateAudit }) {
  const stageIdx = currentAuditStage(audit);

  return (
    <div style={styles.editorCard}>
      <div style={styles.editorHead}>
        <div>
          <div style={styles.editorTitle}>{audit.name}</div>
          <div style={styles.editorMeta}><UnitTag id={audit.unit} /> · {UNITS.find(u => u.id === audit.unit)?.name}</div>
        </div>
        <StageBadge stageIdx={stageIdx} />
      </div>

      <StageTrail stageIdx={stageIdx} />

      <div style={styles.formRow2}>
        <Field label="Auditor">
          <div style={styles.readOnlyPill}>{audit.auditor || "Unassigned"}</div>
        </Field>
        <Field label="Process Owner (PO)">
          <div style={styles.readOnlyPill}>{audit.po || "Unassigned"}</div>
        </Field>
      </div>
      <p style={{ fontSize: 11.5, color: "#A3ABBB", margin: "-10px 0 0" }}>Auditor and PO assignment is managed by your admin under Setup.</p>

      <div style={styles.divider} />

      <div style={styles.formRow2}>
        <Field label="Audit Note Issue Date">
          <input type="date" value={audit.noteIssueDate || ""} onChange={e => updateAudit(audit.id, { noteIssueDate: e.target.value })} style={styles.input} />
        </Field>
        <Field label="Pre-Draft Audit Report Date">
          <input type="date" value={audit.preDraftDate || ""} onChange={e => updateAudit(audit.id, { preDraftDate: e.target.value })} style={styles.input} />
        </Field>
        <Field label="DAR Discussion Date">
          <input type="date" value={audit.darDiscussionDate || ""} onChange={e => updateAudit(audit.id, { darDiscussionDate: e.target.value })} style={styles.input} />
        </Field>
        <Field label="DAR Issue Date">
          <input type="date" value={audit.darIssueDate || ""} onChange={e => updateAudit(audit.id, { darIssueDate: e.target.value })} style={styles.input} />
        </Field>
        <Field label="Final Audit Report Published">
          <input type="date" value={audit.finalPublishDate || ""} onChange={e => updateAudit(audit.id, { finalPublishDate: e.target.value })} style={styles.input} />
        </Field>
      </div>

      <div style={styles.divider} />

      <LocationVisits audit={audit} updateAudit={updateAudit} />
    </div>
  );
}

function StageBadge({ stageIdx }) {
  if (stageIdx === -1) return <span style={{ ...styles.badge, background: "#EFF3F8", color: "#8A93A6" }}>Not Started</span>;
  if (stageIdx === 5) return <span style={{ ...styles.badge, background: "#E8F1EE", color: "#4C8577" }}>Completed</span>;
  return <span style={{ ...styles.badge, background: "#EAF1F8", color: "#007BC9" }}>{STAGES[stageIdx].label}</span>;
}

function StageTrail({ stageIdx }) {
  return (
    <div style={styles.trail}>
      {STAGES.map((s, i) => {
        const done = i <= stageIdx;
        return (
          <React.Fragment key={s.key}>
            <div style={styles.trailStep}>
              <div style={{ ...styles.trailDot, background: done ? "#00456E" : "#fff", borderColor: done ? "#00456E" : "#C7CEDA" }}>
                {done && <Check size={10} color="#fff" strokeWidth={3} />}
              </div>
              <div style={{ ...styles.trailLabel, color: done ? "#00456E" : "#A3ABBB", fontWeight: done ? 600 : 500 }}>{s.short}</div>
            </div>
            {i < STAGES.length - 1 && <div style={{ ...styles.trailLine, background: i < stageIdx ? "#00456E" : "#DFE3E9" }} />}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function LocationVisits({ audit, updateAudit }) {
  const visits = audit.locationVisits || [];

  const addVisit = () => {
    updateAudit(audit.id, { locationVisits: [...visits, { id: uid(), type: LOCATION_TYPES[0], date: "" }] });
  };
  const patchVisit = (vid, patch) => {
    updateAudit(audit.id, { locationVisits: visits.map(v => v.id === vid ? { ...v, ...patch } : v) });
  };
  const removeVisit = (vid) => {
    updateAudit(audit.id, { locationVisits: visits.filter(v => v.id !== vid) });
  };

  return (
    <div>
      <div style={styles.subHeadRow}>
        <span style={styles.subHead}><MapPin size={14} style={{ marginRight: 5, verticalAlign: -2 }} />Location Visits</span>
        <button onClick={addVisit} style={styles.smallBtn}><Plus size={13} /> Add visit</button>
      </div>
      {visits.length === 0 && <div style={styles.emptyNote}>No location visits recorded. Add one if this audit involves site visits.</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {visits.map(v => (
          <div key={v.id} style={styles.visitRow} className="fade-row">
            <select value={v.type} onChange={e => patchVisit(v.id, { type: e.target.value })} style={{ ...styles.select, flex: 1.3 }}>
              {LOCATION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <input type="date" value={v.date} onChange={e => patchVisit(v.id, { date: e.target.value })} style={{ ...styles.input, flex: 1 }} />
            <button onClick={() => removeVisit(v.id)} style={styles.iconBtn}><Trash2 size={14} color="#B0483F" /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label style={styles.field}>
      <span style={styles.fieldLabel}>{label}</span>
      {children}
    </label>
  );
}

/* ============================================================
   AUDITOR PERFORMANCE SCREEN
   ============================================================ */
function AuditorPerformance({ state }) {
  const overdueThresholdDays = 90;
  const [openAuditor, setOpenAuditor] = useState(null);
  const now = new Date();
  const { fyLabel, fyStartYear } = fyQuarterInfo(now);
  const quarterRanges = [
    { label: "Q1", start: new Date(fyStartYear, 3, 1), end: new Date(fyStartYear, 5, 30) },
    { label: "Q2", start: new Date(fyStartYear, 6, 1), end: new Date(fyStartYear, 8, 30) },
    { label: "Q3", start: new Date(fyStartYear, 9, 1), end: new Date(fyStartYear, 11, 31) },
    { label: "Q4", start: new Date(fyStartYear + 1, 0, 1), end: new Date(fyStartYear + 1, 2, 31) },
  ];

  const rows = useMemo(() => state.auditors.map(name => {
    const mine = state.audits.filter(a => a.auditor === name);
    const total = mine.length;
    const completed = mine.filter(isComplete).length;
    const notStarted = mine.filter(a => currentAuditStage(a) === -1).length;
    const inProgress = total - completed - notStarted;
    const overdue = mine.filter(a => !isComplete(a) && a.noteIssueDate && daysBetween(a.noteIssueDate, new Date()) > overdueThresholdDays).length;
    const done = mine.filter(a => isComplete(a) && a.noteIssueDate);
    const avg = done.length ? Math.round(done.reduce((s, a) => s + daysBetween(a.noteIssueDate, a.finalPublishDate), 0) / done.length) : null;
    const pct = total ? Math.round((completed / total) * 100) : 0;

    const quarters = quarterRanges.map(q => {
      const closedInQ = done.filter(a => {
        const d = new Date(a.finalPublishDate);
        return d >= q.start && d <= q.end;
      });
      const qAvg = closedInQ.length ? Math.round(closedInQ.reduce((s, a) => s + daysBetween(a.noteIssueDate, a.finalPublishDate), 0) / closedInQ.length) : null;
      return { label: q.label, completed: closedInQ.length, avg: qAvg };
    });

    return { name, total, completed, inProgress, notStarted, overdue, avg, pct, quarters, audits: mine };
  }).sort((a, b) => b.total - a.total), [state]);

  const unassigned = state.audits.filter(a => !a.auditor).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div>
        <div style={styles.eyebrow}>Performance</div>
        <h1 style={styles.h1}>Auditor Performance</h1>
        <p style={styles.leadText}>
          Tap an auditor to see their {fyLabel} quarter-wise completions and average turnaround.
          {unassigned > 0 && <> · <span style={{ color: "#8A93A6" }}>{unassigned} audit{unassigned !== 1 ? "s" : ""} still unassigned</span></>}
        </p>
      </div>

      {rows.length === 0 && <p style={styles.emptyNote}>No auditors set up yet — add names under Setup → Auditors.</p>}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {rows.map(r => {
          const isOpen = openAuditor === r.name;
          return (
            <div key={r.name} style={styles.perfCard} className="card-hover">
              <button type="button" onClick={() => setOpenAuditor(isOpen ? null : r.name)} style={styles.perfCardHead}>
                <div style={{ textAlign: "left" }}>
                  <div style={styles.perfName}>{r.name}</div>
                  <div style={styles.perfSub}>{r.total} assigned · {r.completed} completed · avg {r.avg !== null ? `${r.avg}d` : "—"}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {r.overdue > 0 && <span style={styles.overdueBadge}>{r.overdue} overdue</span>}
                  <span style={styles.perfPct}>{r.total ? `${r.pct}%` : "—"}</span>
                  {isOpen ? <ChevronDown size={16} color="#8A93A6" /> : <ChevronRight size={16} color="#8A93A6" />}
                </div>
              </button>

              {isOpen && (
                <div style={styles.perfDetail} className="fade-row">
                  <div style={styles.perfStatRow}>
                    <DetailStat label="Assigned" value={r.total} accent="#00456E" />
                    <DetailStat label="Completed" value={r.completed} accent="#4C8577" />
                    <DetailStat label="In Progress" value={r.inProgress} accent="#007BC9" />
                    <DetailStat label="Not Started" value={r.notStarted} accent="#8A93A6" />
                  </div>

                  <div style={styles.detailListTitle}>{fyLabel} — Completed by Quarter</div>
                  <div style={styles.quarterMiniGrid}>
                    {r.quarters.map(q => (
                      <div key={q.label} style={styles.quarterMiniTile}>
                        <div style={styles.quarterMiniLabel}>{q.label}</div>
                        <div style={styles.quarterMiniValue}>{q.completed}</div>
                        <div style={styles.quarterMiniSub}>{q.avg !== null ? `avg ${q.avg}d` : "no closures"}</div>
                      </div>
                    ))}
                  </div>

                  <div style={styles.detailListTitle}>Their Audits</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {r.audits.length === 0 && <div style={styles.emptyNote}>No audits assigned yet.</div>}
                    {r.audits.map(a => {
                      const stageIdx = currentAuditStage(a);
                      return (
                        <div key={a.id} style={styles.entityRow}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: 13.5, color: "#00456E" }}>{a.name}</div>
                            <div style={{ fontSize: 11.5, color: "#8A93A6", marginTop: 2 }}><UnitTag id={a.unit} /> · {a.po ? `PO: ${a.po}` : "no PO assigned"}</div>
                          </div>
                          <StageBadge stageIdx={stageIdx} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ============================================================
   PRINTABLE PDF REPORT (rendered only when printing / Download PDF)
   ============================================================ */
function PrintReport({ state }) {
  const { audits, auditors } = state;
  const total = audits.length;
  const completed = audits.filter(isComplete).length;
  const notStarted = audits.filter(a => currentAuditStage(a) === -1).length;
  const ongoing = total - completed - notStarted;
  const now = new Date();

  const { fyLabel, fyStartYear, q: currentQ } = fyQuarterInfo(now);
  const fyStart = new Date(fyStartYear, 3, 1), fyEnd = new Date(fyStartYear + 1, 2, 31);
  const fyAudits = audits.filter(a => { const ref = new Date(a.noteIssueDate || a.createdAt || now); return ref >= fyStart && ref <= fyEnd; });
  const totalPlanned = fyAudits.length || total;
  const quarterEnds = [new Date(fyStartYear, 5, 30), new Date(fyStartYear, 8, 30), new Date(fyStartYear, 11, 31), new Date(fyStartYear + 1, 2, 31)];
  const pool = fyAudits.length ? fyAudits : audits;

  const unitRows = UNITS.map(u => {
    const ua = audits.filter(a => a.unit === u.id);
    const uc = ua.filter(isComplete).length;
    const uns = ua.filter(a => currentAuditStage(a) === -1).length;
    const active = ua.length - uc - uns;
    const done = ua.filter(a => isComplete(a) && a.noteIssueDate);
    const avg = done.length ? Math.round(done.reduce((s, a) => s + daysBetween(a.noteIssueDate, a.finalPublishDate), 0) / done.length) : null;
    return { ...u, total: ua.length, completed: uc, active, notStarted: uns, avg, pct: ua.length ? Math.round((uc / ua.length) * 100) : 0 };
  });

  const auditorRows = auditors.map(name => {
    const mine = audits.filter(a => a.auditor === name);
    const c = mine.filter(isComplete).length;
    return { name, total: mine.length, completed: c, pct: mine.length ? Math.round((c / mine.length) * 100) : 0 };
  });

  const pStyle = { fontFamily: "Georgia, serif", color: "#00456E" };
  const th = { textAlign: "left", padding: "6px 8px", fontSize: 10.5, borderBottom: "2px solid #00456E", textTransform: "uppercase", letterSpacing: 0.3 };
  const td = { padding: "6px 8px", fontSize: 11, borderBottom: "1px solid #ddd" };

  return (
    <div style={{ ...pStyle, padding: "24px 28px", fontFamily: "Georgia, serif", fontSize: 12 }}>
      <h1 style={{ fontSize: 22, margin: "0 0 2px" }}>Internal Audit — Status Report</h1>
      <p style={{ color: "#5A6478", margin: "0 0 20px", fontFamily: "Arial, sans-serif", fontSize: 11 }}>
        Generated {now.toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })}
      </p>

      <h2 style={{ fontSize: 15, borderBottom: "2px solid #00456E", paddingBottom: 4 }}>Summary</h2>
      <p style={{ fontFamily: "Arial, sans-serif", fontSize: 12, lineHeight: 1.7 }}>
        Total audits: <b>{total}</b> &nbsp;|&nbsp; Completed: <b>{completed}</b> &nbsp;|&nbsp;
        In Progress: <b>{ongoing}</b> &nbsp;|&nbsp; Not Started: <b>{notStarted}</b>
      </p>

      <h2 style={{ fontSize: 15, borderBottom: "2px solid #00456E", paddingBottom: 4, marginTop: 24 }}>Unit-wise Status</h2>
      <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "Arial, sans-serif" }}>
        <thead><tr>{["Unit", "Total", "Completed", "Active", "Not Started", "% Complete", "Avg Days"].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
        <tbody>
          {unitRows.map(u => (
            <tr key={u.id}>
              <td style={td}>{u.id} — {u.name}</td>
              <td style={td}>{u.total}</td><td style={td}>{u.completed}</td><td style={td}>{u.active}</td>
              <td style={td}>{u.notStarted}</td><td style={td}>{u.pct}%</td><td style={td}>{u.avg !== null ? `${u.avg}d` : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 style={{ fontSize: 15, borderBottom: "2px solid #00456E", paddingBottom: 4, marginTop: 24 }}>Target vs Actual — {fyLabel}</h2>
      <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "Arial, sans-serif" }}>
        <thead><tr>{["Quarter", "Target %", "Actual %", "Closed", "Status"].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
        <tbody>
          {["Q1", "Q2", "Q3", "Q4"].map((label, i) => {
            const targetPct = (i + 1) * 25;
            const actualCount = pool.filter(a => a.finalPublishDate && new Date(a.finalPublishDate) <= quarterEnds[i]).length;
            const actualPct = totalPlanned > 0 ? Math.round((actualCount / totalPlanned) * 100) : 0;
            const isFuture = (i + 1) > currentQ;
            const status = isFuture ? "Upcoming" : (actualPct >= targetPct ? "On track" : "Behind");
            return (
              <tr key={label}>
                <td style={td}>{label}</td><td style={td}>{targetPct}%</td><td style={td}>{actualPct}%</td>
                <td style={td}>{actualCount}</td><td style={td}>{status}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {auditorRows.length > 0 && (
        <>
          <h2 style={{ fontSize: 15, borderBottom: "2px solid #00456E", paddingBottom: 4, marginTop: 24 }}>Auditor Performance</h2>
          <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "Arial, sans-serif" }}>
            <thead><tr>{["Auditor", "Assigned", "Completed", "% Complete"].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
            <tbody>
              {auditorRows.map(r => (
                <tr key={r.name}><td style={td}>{r.name}</td><td style={td}>{r.total}</td><td style={td}>{r.completed}</td><td style={td}>{r.pct}%</td></tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <h2 style={{ fontSize: 15, borderBottom: "2px solid #00456E", paddingBottom: 4, marginTop: 24 }}>All Audits</h2>
      <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "Arial, sans-serif" }}>
        <thead><tr>{["Unit", "Audit", "Auditor", "PO", "Stage", "Note Issued", "Published"].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
        <tbody>
          {audits.map(a => {
            const idx = currentAuditStage(a);
            const stageLabel = idx === -1 ? "Not Started" : STAGES[idx].label;
            return (
              <tr key={a.id}>
                <td style={td}>{a.unit}</td><td style={td}>{a.name}</td><td style={td}>{a.auditor || "—"}</td>
                <td style={td}>{a.po || "—"}</td><td style={td}>{stageLabel}</td>
                <td style={td}>{fmtDate(a.noteIssueDate)}</td><td style={td}>{fmtDate(a.finalPublishDate)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ============================================================
   ADMIN / SETUP SCREEN
   ============================================================ */
function AdminScreen({ state, persist }) {
  const [tab, setTab] = useState("audits");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 900 }}>
      <div>
        <div style={styles.eyebrow}>Configuration</div>
        <h1 style={styles.h1}>Setup &amp; Master Lists</h1>
        <p style={styles.leadText}>Manage the audit list, auditor roster and PO roster. Paste from Excel or add manually. This data is shared with everyone using the app.</p>
      </div>

      <div style={styles.subNav}>
        <button onClick={() => setTab("audits")} style={{ ...styles.subNavBtn, ...(tab === "audits" ? styles.subNavBtnActive : {}) }}><FileStack size={14} /> Audits</button>
        <button onClick={() => setTab("auditors")} style={{ ...styles.subNavBtn, ...(tab === "auditors" ? styles.subNavBtnActive : {}) }}><Users size={14} /> Auditors</button>
        <button onClick={() => setTab("pos")} style={{ ...styles.subNavBtn, ...(tab === "pos" ? styles.subNavBtnActive : {}) }}><UserSquare2 size={14} /> POs</button>
      </div>

      {tab === "audits" && <AuditsAdmin state={state} persist={persist} />}
      {tab === "auditors" && <NameListAdmin listKey="auditors" title="Auditor Roster" state={state} persist={persist} />}
      {tab === "pos" && <NameListAdmin listKey="pos" title="Process Owner (PO) Roster" state={state} persist={persist} />}
    </div>
  );
}

function AuditsAdmin({ state, persist }) {
  const [unit, setUnit] = useState(UNITS[0].id);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [manualName, setManualName] = useState("");

  const importPasted = () => {
    const lines = pasteText.split("\n").map(s => s.trim()).filter(Boolean);
    if (!lines.length) return;
    const auditorSet = new Set(state.auditors);
    const poSet = new Set(state.pos);
    const newAudits = lines.map(line => {
      const [name = "", auditor = "", po = ""] = line.split(/\t|,/).map(s => s.trim());
      if (auditor) auditorSet.add(auditor);
      if (po) poSet.add(po);
      return {
        id: uid(), name, unit, auditor, po,
        noteIssueDate: "", locationVisits: [], preDraftDate: "",
        darDiscussionDate: "", darIssueDate: "", finalPublishDate: "",
        createdAt: new Date().toISOString(),
      };
    }).filter(a => a.name);
    if (!newAudits.length) return;
    persist({ ...state, audits: [...state.audits, ...newAudits], auditors: Array.from(auditorSet), pos: Array.from(poSet) });
    setPasteText("");
    setPasteOpen(false);
  };

  const addManual = () => {
    if (!manualName.trim()) return;
    const a = {
      id: uid(), name: manualName.trim(), unit, auditor: "", po: "",
      noteIssueDate: "", locationVisits: [], preDraftDate: "",
      darDiscussionDate: "", darIssueDate: "", finalPublishDate: "",
      createdAt: new Date().toISOString(),
    };
    persist({ ...state, audits: [...state.audits, a] });
    setManualName("");
  };

  const removeAudit = (id) => persist({ ...state, audits: state.audits.filter(a => a.id !== id) });
  const assignAudit = (id, patch) => persist({ ...state, audits: state.audits.map(a => a.id === id ? { ...a, ...patch } : a) });

  const grouped = UNITS.map(u => ({ unit: u, audits: state.audits.filter(a => a.unit === u.id) }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={styles.panel}>
        <div style={styles.panelTitle}>Add Audits</div>
        <div style={styles.formRow2}>
          <Field label="Unit">
            <select value={unit} onChange={e => setUnit(e.target.value)} style={styles.select}>
              {UNITS.map(u => <option key={u.id} value={u.id}>{u.id} — {u.name}</option>)}
            </select>
          </Field>
          <Field label="Add single audit">
            <div style={{ display: "flex", gap: 8 }}>
              <input value={manualName} onChange={e => setManualName(e.target.value)} placeholder="Audit name / title" style={{ ...styles.input, flex: 1 }}
                onKeyDown={e => e.key === "Enter" && addManual()} />
              <button onClick={addManual} style={styles.primaryBtnSm}><Plus size={14} /></button>
            </div>
          </Field>
        </div>

        <button onClick={() => setPasteOpen(v => !v)} style={styles.linkBtn}>
          <Upload size={13} /> {pasteOpen ? "Hide" : "Bulk upload — paste audits, auditor & PO"}
        </button>
        {pasteOpen && (
          <div style={{ marginTop: 10 }}>
            <textarea
              value={pasteText}
              onChange={e => setPasteText(e.target.value)}
              placeholder={"One audit per line. Just the name works, or add auditor/PO too — paste straight from a 3-column Excel selection, or type:\nCoimbatore retail, R. Sharma, S. Nair\nChennai depot, K. Iyer\n\nAll go into the unit selected above. New auditor/PO names are added to their rosters automatically."}
              style={styles.textarea}
              rows={6}
            />
            <button onClick={importPasted} style={{ ...styles.primaryBtnSm, marginTop: 8 }}><Upload size={13} /> Import {pasteText.split("\n").filter(s => s.trim()).length || ""} audits</button>
          </div>
        )}
      </div>

      <div style={styles.panel}>
        <div style={styles.panelTitle}>Audit List by Unit</div>
        {grouped.map(({ unit: u, audits }) => (
          <UnitAuditGroup key={u.id} unit={u} audits={audits} removeAudit={removeAudit} assignAudit={assignAudit} auditors={state.auditors} pos={state.pos} />
        ))}
      </div>
    </div>
  );
}

function UnitAuditGroup({ unit, audits, removeAudit, assignAudit, auditors, pos }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={styles.groupBlock}>
      <button onClick={() => setOpen(v => !v)} style={styles.groupHead}>
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <UnitTag id={unit.id} /> <span style={{ fontWeight: 600 }}>{unit.name}</span>
        <span style={{ color: "#8A93A6", fontWeight: 400 }}>{audits.length} audit{audits.length !== 1 ? "s" : ""}</span>
      </button>
      {open && (
        <div style={{ paddingLeft: 26, display: "flex", flexDirection: "column", gap: 8, marginTop: 6 }}>
          {audits.length === 0 && <div style={styles.emptyNote}>No audits added yet.</div>}
          {audits.map(a => (
            <div key={a.id} style={styles.assignRow} className="fade-row">
              <span style={styles.assignRowName}>{a.name}</span>
              <select value={a.auditor || ""} onChange={e => assignAudit(a.id, { auditor: e.target.value })} style={{ ...styles.select, ...styles.assignSelect }}>
                <option value="">Assign auditor…</option>
                {auditors.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
              <select value={a.po || ""} onChange={e => assignAudit(a.id, { po: e.target.value })} style={{ ...styles.select, ...styles.assignSelect }}>
                <option value="">Assign PO…</option>
                {pos.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
              <button onClick={() => removeAudit(a.id)} style={styles.iconBtn}><Trash2 size={13} color="#B0483F" /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function NameListAdmin({ listKey, title, state, persist }) {
  const [pasteText, setPasteText] = useState("");
  const [single, setSingle] = useState("");
  const list = state[listKey];

  const addSingle = () => {
    const v = single.trim();
    if (!v || list.includes(v)) return;
    persist({ ...state, [listKey]: [...list, v] });
    setSingle("");
  };
  const importPasted = () => {
    const names = pasteText.split("\n").map(s => s.trim()).filter(Boolean);
    const merged = Array.from(new Set([...list, ...names]));
    persist({ ...state, [listKey]: merged });
    setPasteText("");
  };
  const remove = (name) => persist({ ...state, [listKey]: list.filter(n => n !== name) });

  return (
    <div style={styles.panel}>
      <div style={styles.panelTitle}>{title}</div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <input value={single} onChange={e => setSingle(e.target.value)} placeholder="Add a name" style={{ ...styles.input, flex: 1 }}
          onKeyDown={e => e.key === "Enter" && addSingle()} />
        <button onClick={addSingle} style={styles.primaryBtnSm}><Plus size={14} /></button>
      </div>
      <textarea value={pasteText} onChange={e => setPasteText(e.target.value)} placeholder={"Or paste multiple names, one per line"} style={styles.textarea} rows={3} />
      <button onClick={importPasted} style={{ ...styles.primaryBtnSm, marginTop: 8 }}><Upload size={13} /> Import list</button>

      <div style={{ marginTop: 16, display: "flex", flexWrap: "wrap", gap: 8 }}>
        {list.length === 0 && <div style={styles.emptyNote}>No names added yet.</div>}
        {list.map(n => (
          <span key={n} style={styles.chip}>
            {n}
            <button onClick={() => remove(n)} style={styles.chipX}><X size={11} /></button>
          </span>
        ))}
      </div>
    </div>
  );
}

/* ============================================================
   STYLES
   ============================================================ */
const styles = {
  appShell: { minHeight: "100vh", background: "#EEF5FB", fontFamily: "'IBM Plex Sans', sans-serif", color: "#1C2733" },
  main: { maxWidth: 1180, margin: "0 auto", padding: "28px 28px 80px" },

  nav: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "14px 28px", background: "#00456E", position: "sticky", top: 0, zIndex: 20,
    boxShadow: "0 1px 0 rgba(0,0,0,0.08)", flexWrap: "wrap", gap: 12,
  },
  navBrand: { display: "flex", alignItems: "center", gap: 12 },
  navMark: {
    width: 34, height: 34, borderRadius: 7, background: "#FFE000", color: "#00456E",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: 13, letterSpacing: 0.5,
  },
  navLogoImg: { height: 34, width: "auto", maxWidth: 120, objectFit: "contain" },
  navTitle: { color: "#fff", fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 16, lineHeight: 1.1 },
  navSub: { color: "#9FB0C7", fontSize: 11.5, marginTop: 1 },
  navTabs: { display: "flex", gap: 4, background: "rgba(255,255,255,0.06)", padding: 4, borderRadius: 9, flexWrap: "wrap" },
  navTab: {
    display: "flex", alignItems: "center", gap: 6, padding: "7px 13px", borderRadius: 6,
    border: "none", background: "transparent", color: "#B9C4D6", fontSize: 13, fontWeight: 500,
    cursor: "pointer", transition: "all .15s ease",
  },
  navTabActive: { background: "#fff", color: "#00456E" },
  saveIndicator: { color: "#9FB0C7", fontSize: 12, display: "flex", alignItems: "center", gap: 5, minWidth: 70, justifyContent: "flex-end" },

  eyebrow: { fontSize: 11.5, letterSpacing: 1.4, textTransform: "uppercase", color: "#007BC9", fontWeight: 600, marginBottom: 6 },
  h1: { fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 30, margin: 0, color: "#00456E" },
  leadText: { color: "#5A6478", fontSize: 14, marginTop: 8, maxWidth: 640, lineHeight: 1.5 },

  sectionHeader: { fontFamily: "'Fraunces', serif", fontSize: 16, fontWeight: 600, color: "#00456E", marginBottom: 12 },

  statRow: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 },
  statTile: { background: "#fff", border: "1px solid #E2E6ED", borderRadius: 10, padding: "14px 16px" },
  statLabel: { fontSize: 11.5, color: "#8A93A6", fontWeight: 500, textTransform: "uppercase", letterSpacing: 0.4 },
  statValue: { fontFamily: "'IBM Plex Mono', monospace", fontSize: 26, fontWeight: 600, marginTop: 6 },
  statSub: { fontSize: 10.5, color: "#A3ABBB", marginTop: 3 },

  targetCard: { background: "#fff", border: "1px solid #E2E6ED", borderRadius: 10, padding: "18px 20px", display: "flex", flexDirection: "column", gap: 16 },
  quarterChartWrap: { width: "100%", height: 190 },
  quarterChartLegend: { display: "flex", gap: 16, flexWrap: "wrap", paddingBottom: 4, borderBottom: "1px solid #EEF0F4" },

  donutCard: { background: "#fff", border: "1px solid #E2E6ED", borderRadius: 12, padding: "18px 20px", display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap", justifyContent: "center" },
  donutChartWrap: { width: 150, height: 150, position: "relative", flexShrink: 0 },
  donutCenter: { position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none" },
  donutCenterValue: { fontFamily: "'IBM Plex Mono', monospace", fontSize: 28, fontWeight: 600, color: "#00456E", lineHeight: 1 },
  donutCenterLabel: { fontSize: 10.5, color: "#A3ABBB", marginTop: 2, textTransform: "uppercase", letterSpacing: 0.4 },
  donutLegend: { display: "flex", flexDirection: "column", gap: 9, minWidth: 200, flex: 1 },
  donutLegendTitle: { fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 14, color: "#00456E", marginBottom: 2 },
  donutLegendRow: { display: "flex", alignItems: "center", gap: 8, fontSize: 13 },

  miniGauge: { width: 52, height: 52, position: "relative", flexShrink: 0 },
  miniGaugeLabel: { position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, fontWeight: 700, color: "#00456E" },
  quarterRow: { display: "grid", gridTemplateColumns: "56px 1fr 190px", alignItems: "center", gap: 14 },
  quarterLabel: { fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 14, color: "#00456E", display: "flex", alignItems: "center", gap: 6 },
  nowPill: { fontSize: 9, background: "#FFE000", color: "#00456E", padding: "1px 6px", borderRadius: 20, fontFamily: "'IBM Plex Sans'", fontWeight: 600, textTransform: "uppercase" },
  ruler: { position: "relative" },
  rulerTrack: { position: "relative", height: 10, background: "#EFF3F8", borderRadius: 5, overflow: "visible" },
  rulerFill: { position: "absolute", left: 0, top: 0, bottom: 0, borderRadius: 5, transition: "width .3s ease" },
  targetTick: { position: "absolute", top: -3, bottom: -3, width: 2, background: "#FFE000" },
  quarterFigures: { textAlign: "right", fontSize: 12.5 },

  unitGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 14 },
  unitCard: { background: "#fff", border: "1px solid #E2E6ED", borderRadius: 10, padding: "16px 18px" },
  unitCardHead: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  unitCode: { fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "#007BC9", fontWeight: 600, letterSpacing: 0.5 },
  unitName: { fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 15.5, color: "#00456E", marginTop: 1 },
  unitPct: { fontFamily: "'IBM Plex Mono', monospace", fontSize: 18, fontWeight: 600, color: "#00456E" },
  unitBarTrack: { display: "flex", height: 7, borderRadius: 4, overflow: "hidden", background: "#EFF3F8" },
  unitLegend: { display: "flex", gap: 12, marginTop: 10, flexWrap: "wrap" },
  unitFoot: { display: "flex", justifyContent: "space-between", marginTop: 12, paddingTop: 10, borderTop: "1px solid #EEF0F4", fontSize: 11.5, color: "#8A93A6" },
  unitTapHint: { display: "flex", alignItems: "center", gap: 3, marginTop: 10, fontSize: 11.5, fontWeight: 600, color: "#007BC9", justifyContent: "center", width: "100%", background: "#EAF1F8", border: "none", borderRadius: 7, padding: "8px 0", cursor: "pointer", fontFamily: "'IBM Plex Sans', sans-serif" },

  detailPanel: { background: "#fff", border: "1px solid #E2E6ED", borderRadius: 12, padding: 20, display: "flex", flexDirection: "column", gap: 16 },
  detailHead: { display: "flex", justifyContent: "space-between", alignItems: "flex-start" },
  detailStatRow: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 10 },
  detailStatTile: { background: "#F8F9FB", border: "1px solid #EEF0F4", borderRadius: 8, padding: "10px 12px" },
  detailStatLabel: { fontSize: 10, color: "#8A93A6", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.3 },
  detailStatValue: { fontFamily: "'IBM Plex Mono', monospace", fontSize: 19, fontWeight: 600, marginTop: 4 },

  perfCard: { background: "#fff", border: "1px solid #E2E6ED", borderRadius: 10, overflow: "hidden" },
  perfCardHead: { display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", background: "transparent", border: "none", padding: "14px 16px", cursor: "pointer", textAlign: "left" },
  perfName: { fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 15.5, color: "#00456E" },
  perfSub: { fontSize: 12, color: "#8A93A6", marginTop: 3 },
  perfPct: { fontFamily: "'IBM Plex Mono', monospace", fontSize: 17, fontWeight: 600, color: "#00456E" },
  overdueBadge: { fontSize: 10.5, fontWeight: 600, color: "#fff", background: "#B0483F", borderRadius: 20, padding: "3px 8px" },
  perfDetail: { padding: "0 16px 18px", display: "flex", flexDirection: "column", gap: 14, borderTop: "1px solid #EEF0F4" },
  perfStatRow: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(90px, 1fr))", gap: 8, marginTop: 14 },
  quarterMiniGrid: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 },
  quarterMiniTile: { background: "#F8F9FB", border: "1px solid #EEF0F4", borderRadius: 8, padding: "10px 8px", textAlign: "center" },
  quarterMiniLabel: { fontSize: 10.5, color: "#8A93A6", fontWeight: 600, textTransform: "uppercase" },
  quarterMiniValue: { fontFamily: "'IBM Plex Mono', monospace", fontSize: 20, fontWeight: 600, color: "#00456E", marginTop: 4 },
  quarterMiniSub: { fontSize: 9.5, color: "#A3ABBB", marginTop: 2 },
  detailListTitle: { fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 14, color: "#00456E", borderTop: "1px solid #EEF0F4", paddingTop: 14 },
  entityRow: { display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", background: "#F8F9FB", borderRadius: 8 },

  tableWrap: { background: "#fff", border: "1px solid #E2E6ED", borderRadius: 10, overflow: "auto" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
  th: { textAlign: "left", padding: "10px 14px", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.4, color: "#8A93A6", borderBottom: "1px solid #E2E6ED", fontWeight: 600 },
  td: { padding: "10px 14px", borderBottom: "1px solid #EFF3F8" },
  unitTag: { fontFamily: "'IBM Plex Mono', monospace", fontSize: 10.5, background: "#EAF1F8", color: "#007BC9", padding: "2px 6px", borderRadius: 4, fontWeight: 600 },

  formRow2: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 },
  field: { display: "flex", flexDirection: "column", gap: 5 },
  fieldLabel: { fontSize: 12, fontWeight: 600, color: "#5A6478" },
  select: { padding: "9px 10px", borderRadius: 7, border: "1px solid #D6DAE2", background: "#fff", fontSize: 13.5, color: "#1C2733", outline: "none" },
  readOnlyPill: { padding: "9px 10px", borderRadius: 7, border: "1px solid #E2E6ED", background: "#F8F9FB", fontSize: 13.5, color: "#5A6478" },
  input: { padding: "9px 10px", borderRadius: 7, border: "1px solid #D6DAE2", background: "#fff", fontSize: 13.5, color: "#1C2733", outline: "none", fontFamily: "'IBM Plex Mono', monospace" },
  textarea: { width: "100%", padding: "10px 12px", borderRadius: 7, border: "1px solid #D6DAE2", fontSize: 13, resize: "vertical", outline: "none" },

  editorCard: { background: "#fff", border: "1px solid #E2E6ED", borderRadius: 12, padding: 22, display: "flex", flexDirection: "column", gap: 18 },
  editorHead: { display: "flex", justifyContent: "space-between", alignItems: "flex-start" },
  editorTitle: { fontFamily: "'Fraunces', serif", fontSize: 19, fontWeight: 600, color: "#00456E" },
  editorMeta: { fontSize: 12.5, color: "#8A93A6", marginTop: 4, display: "flex", alignItems: "center", gap: 5 },
  badge: { fontSize: 11.5, fontWeight: 600, padding: "4px 10px", borderRadius: 20 },

  trail: { display: "flex", alignItems: "center", padding: "6px 2px" },
  trailStep: { display: "flex", flexDirection: "column", alignItems: "center", gap: 6, width: 64 },
  trailDot: { width: 20, height: 20, borderRadius: "50%", border: "2px solid", display: "flex", alignItems: "center", justifyContent: "center" },
  trailLabel: { fontSize: 9.5, textAlign: "center", lineHeight: 1.2 },
  trailLine: { flex: 1, height: 2, marginBottom: 18, minWidth: 8 },

  divider: { height: 1, background: "#EEF0F4" },

  subHeadRow: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  subHead: { fontSize: 13.5, fontWeight: 600, color: "#00456E" },
  smallBtn: { display: "flex", alignItems: "center", gap: 5, background: "#EAF1F8", color: "#007BC9", border: "none", borderRadius: 7, padding: "6px 11px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" },
  visitRow: { display: "flex", gap: 8, alignItems: "center" },
  iconBtn: { border: "none", background: "transparent", cursor: "pointer", padding: 6, display: "flex", borderRadius: 6 },
  emptyNote: { fontSize: 12.5, color: "#A3ABBB", fontStyle: "italic", padding: "6px 0" },

  subNav: { display: "flex", gap: 8 },
  subNavBtn: { display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, border: "1px solid #E2E6ED", background: "#fff", color: "#5A6478", fontSize: 13, fontWeight: 500, cursor: "pointer" },
  subNavBtnActive: { background: "#00456E", color: "#fff", borderColor: "#00456E" },

  panel: { background: "#fff", border: "1px solid #E2E6ED", borderRadius: 12, padding: 20 },
  panelTitle: { fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 16, color: "#00456E", marginBottom: 14 },
  linkBtn: { display: "flex", alignItems: "center", gap: 6, background: "transparent", border: "none", color: "#007BC9", fontSize: 12.5, fontWeight: 600, cursor: "pointer", marginTop: 12, padding: 0 },
  primaryBtnSm: { display: "flex", alignItems: "center", gap: 6, background: "#00456E", color: "#fff", border: "none", borderRadius: 7, padding: "9px 13px", fontSize: 13, fontWeight: 600, cursor: "pointer" },
  shareBtn: { display: "flex", alignItems: "center", gap: 6, background: "#25D366", color: "#fff", border: "none", borderRadius: 7, padding: "9px 14px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", flexShrink: 0 },

  groupBlock: { borderTop: "1px solid #EFF3F8", paddingTop: 10, marginTop: 10 },
  groupHead: { display: "flex", alignItems: "center", gap: 8, background: "transparent", border: "none", cursor: "pointer", fontSize: 13.5, color: "#1C2733", padding: "4px 0", width: "100%", textAlign: "left" },
  auditRow: { display: "flex", alignItems: "center", gap: 10, fontSize: 13, padding: "5px 8px", background: "#F8F9FB", borderRadius: 6 },
  assignRow: { display: "flex", alignItems: "center", gap: 8, fontSize: 13, padding: "6px 8px", background: "#F8F9FB", borderRadius: 6, flexWrap: "wrap" },
  assignRowName: { flex: "1 1 160px", minWidth: 120 },
  assignSelect: { fontSize: 12.5, padding: "6px 8px", flex: "1 1 140px", minWidth: 130 },

  chip: { display: "flex", alignItems: "center", gap: 6, background: "#EFF3F8", color: "#1C2733", padding: "5px 6px 5px 12px", borderRadius: 20, fontSize: 12.5 },
  chipX: { border: "none", background: "#E2E6ED", borderRadius: "50%", width: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#5A6478" },
};
