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
import { auth, signIn, logOut, watchAuth, watchState, saveState, logSignIn, watchSignInLog } from "./firebase";
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
const LOGO_URL = "https://raw.githubusercontent.com/lokeshraja10-ship-it/audit-tracker/main/bpcl-logo.png";
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
  { key: "darDiscussionDate", label: "Post Audit Discussion", short: "Post Disc." },
  { key: "darIssueDate", label: "DAR Issued", short: "DAR Issued" },
  { key: "finalPublishDate", label: "Final Report Published", short: "Published" },
];
const LOCATION_TYPES = ["Regional Office", "Terminal", "Depot", "Retail Outlet", "LPG Plant", "Refinery Site", "Vendor / Third-Party", "Other"];
// Cumulative completion target (%) expected by the END of each quarter — Q1, Q2, Q3, Q4.
// Change these four numbers to re-baseline the "Target vs Actual" chart, ruler bars,
// PDF report and printable report all at once.
const QUARTER_TARGETS = [20, 50, 80, 100];
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
// Where you should be "as on date" against the target pace — a smooth
// day-by-day proportion through the FY, which lines up with the quarter-end
// checkpoints rather than only jumping at those boundaries.
function expectedProgressFraction(date) {
  const { fyStartYear } = fyQuarterInfo(date);
  const fyStart = new Date(fyStartYear, 3, 1);
  const fyEnd = new Date(fyStartYear + 1, 2, 31);
  const totalDays = daysBetween(fyStart, fyEnd) + 1;
  const elapsed = daysBetween(fyStart, date) + 1;
  return Math.min(1, Math.max(0, elapsed / totalDays));
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
// Which region an audit "belongs to" for every grouping/display purpose in the app.
// The assigned PO's own home region wins whenever there is one — since POs can now
// head audits outside their region, the PO's region is what actually determines
// accountability. Falls back to the audit's own unit tag only when there's no PO
// assigned yet, or that PO has no home region set.
function effectiveRegion(audit, pos) {
  if (audit.po) {
    const p = (pos || []).find(x => x.name === audit.po);
    if (p && p.unit) return p.unit;
  }
  return audit.unit;
}
function generatePdfReport(state) {
  const { audits, auditors, pos } = state;
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
    const ua = audits.filter(a => effectiveRegion(a, pos) === u.id);
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
  const totalPlanned = total; // same total as the unit-wise table above — see QuarterlyTarget's fix note
  const quarterEnds = [new Date(fyStartYear, 5, 30), new Date(fyStartYear, 8, 30), new Date(fyStartYear, 11, 31), new Date(fyStartYear + 1, 2, 31)];
  const qRows = ["Q1", "Q2", "Q3", "Q4"].map((label, i) => {
    const targetPct = QUARTER_TARGETS[i];
    const actualCount = audits.filter(a => a.finalPublishDate && new Date(a.finalPublishDate) <= quarterEnds[i]).length;
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
    const auditorRows = auditors.map(p => {
      const mine = audits.filter(a => a.auditor === p.name);
      const c = mine.filter(isComplete).length;
      const safTotal = mine.reduce((s, a) => s + (a.hasSAF ? (Number(a.safCount) || 0) : 0), 0);
      const recTotal = mine.reduce((s, a) => s + (Number(a.recommendationsTotal) || 0), 0);
      return [p.name, p.unit || "—", mine.length, c, mine.length ? `${Math.round((c / mine.length) * 100)}%` : "—", safTotal, recTotal];
    });
    doc.text("Auditor Performance", 14, doc.lastAutoTable.finalY + 10);
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 14,
      head: [["Auditor", "Region", "Assigned", "Completed", "% Complete", "SAFs", "Recommendations"]],
      body: auditorRows,
      headStyles: { fillColor: NAVY_RGB },
      styles: { fontSize: 9 },
    });
  }
  if (audits.length) {
    const auditRows = audits.map(a => {
      const idx = currentAuditStage(a);
      const stageLabel = idx === -1 ? "Not Started" : STAGES[idx].label;
      return [effectiveRegion(a, pos), a.name, a.auditor || "—", a.po || "—", stageLabel, fmtDate(a.noteIssueDate), fmtDate(a.finalPublishDate)];
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
function csvEscape(val) {
  const s = val === null || val === undefined ? "" : String(val);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function generateCsv(state) {
  const headers = ["Unit", "Audit Name", "Auditor", "Process Owner (PO)", "Current Stage",
    "Note Issue Date", "CAR Scripts Run Date", "Pre-Draft Date", "Post Audit Discussion Date",
    "DAR Issue Date", "Concurrence Date", "Final Publish Date", "Audit 360 Updation Date", "AWP Updation Date",
    "Training Done", "Training Date", "HC/NHC Stock Check", "Stock Check Date", "Has SAF", "No. of SAFs",
    "No. of Recommendations", "Recommendations Since Done", "Recommendations ATR Closed", "Recommendations Balance",
    "System/Process Improvement", "Improvement Details"];
  const rows = state.audits.map(a => {
    const idx = currentAuditStage(a);
    const stageLabel = idx === -1 ? "Not Started" : STAGES[idx].label;
    const recTotal = Number(a.recommendationsTotal) || 0;
    const recDone = Number(a.recommendationsSinceDone) || 0;
    const recAtrClosed = Number(a.recommendationsAtrClosed) || 0;
    const recBalance = Math.max(0, recTotal - recDone - recAtrClosed);
    return [effectiveRegion(a, state.pos), a.name, a.auditor || "", a.po || "", stageLabel,
      a.noteIssueDate || "", a.carScriptsRunDate || "", a.preDraftDate || "", a.darDiscussionDate || "",
      a.darIssueDate || "", a.concurrenceDate || "", a.finalPublishDate || "", a.audit360UpdateDate || "", a.awpUpdateDate || "",
      a.trainingDone ? "Yes" : "No", a.trainingDate || "",
      a.stockCheckDone ? "Yes" : "No", a.stockCheckDone ? (a.stockCheckDate || "") : "",
      a.hasSAF ? "Yes" : "No", a.hasSAF ? (a.safCount ?? "") : "",
      a.recommendationsTotal ?? "", a.recommendationsSinceDone ?? "", a.recommendationsAtrClosed ?? "",
      (a.recommendationsTotal || a.recommendationsSinceDone || a.recommendationsAtrClosed) ? recBalance : "",
      a.hasSystemImprovement ? "Yes" : "No", a.hasSystemImprovement ? (a.systemImprovementText || "") : ""];
  });
  const csv = [headers, ...rows].map(row => row.map(csvEscape).join(",")).join("\r\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Audit-Data-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
function DownloadCsvButton({ state }) {
  return (
    <button onClick={() => generateCsv(state)} style={{ ...styles.shareBtn, background: "#007BC9" }}>
      <Download size={13} /> Download Data (CSV)
    </button>
  );
}
const DEFAULT_STATE = { audits: [], auditors: [], pos: [] };
// Auditors/POs used to be plain name strings; they're now {name, unit} so each person
// can be tied to a region. This makes old string-only entries safe to keep working.
function normalizeRoster(list) {
  return (list || []).map((item) => (typeof item === "string" ? { name: item, unit: "" } : item));
}
const ADMIN_SETUP_PIN = "bpcl-admin-2026"; // change this to your own PIN; only people who know it can open Setup
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
    try {
      await signIn(password);
      const remembered = localStorage.getItem("auditor-identity");
      logSignIn(remembered || "(app opened, not yet identified)").catch(() => {});
    }
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
          <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 22, color: "#00456E", margin: "0 0 8px" }}>I-AuditNow</h1>
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
    document.title = "I-AuditNow";
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = FONT_LINK;
    document.head.appendChild(link);
    const unsub = watchState((s) => {
      setState({ ...s, auditors: normalizeRoster(s.auditors), pos: normalizeRoster(s.pos) });
      setLoading(false);
    });
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
          {screen === "admin" && <AdminGate><AdminScreen state={state} persist={persist} /></AdminGate>}
        </main>
        <BottomNav screen={screen} setScreen={setScreen} />
      </div>
      <div className="print-report-only">
        <PrintReport state={state} />
      </div>
    </div>
  );
}
const spinCss = `.spin{animation:spin 0.9s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}`;
function AdminGate({ children }) {
  const [unlocked, setUnlocked] = useState(() => sessionStorage.getItem("admin-unlocked") === "true");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const submit = (e) => {
    e.preventDefault();
    if (pin === ADMIN_SETUP_PIN) {
      sessionStorage.setItem("admin-unlocked", "true");
      setUnlocked(true);
      logSignIn(`(admin unlock)`).catch(() => {});
    } else {
      setError("That PIN isn't correct.");
    }
  };
  if (unlocked) return children;
  return (
    <div style={{ maxWidth: 340 }}>
      <div style={styles.eyebrow}>Restricted</div>
      <h1 style={styles.h1}>Admin PIN required</h1>
      <p style={styles.leadText}>Setup changes are limited to admins. Enter the admin PIN to continue.</p>
      <form onSubmit={submit} style={{ marginTop: 18 }}>
        <input
          type="password" value={pin} onChange={(e) => setPin(e.target.value)} placeholder="Admin PIN" autoFocus
          style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #D6DAE2", fontSize: 14, marginBottom: 10 }}
        />
        <button type="submit" style={styles.primaryBtnSm}>Unlock Setup</button>
        {error && <div style={{ marginTop: 10, color: "#B0483F", fontSize: 12.5 }}>{error}</div>}
      </form>
    </div>
  );
}
const globalCss = `
  @media (max-width: 480px) { .hide-on-narrow { display: none; } }
  @keyframes livePulse {
    0% { box-shadow: 0 0 0 0 rgba(76,133,119,0.6); }
    70% { box-shadow: 0 0 0 6px rgba(76,133,119,0); }
    100% { box-shadow: 0 0 0 0 rgba(76,133,119,0); }
  }
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
  return (
    <header style={styles.nav}>
      <div style={styles.navBrand}>
        {LOGO_URL ? (
          <img src={LOGO_URL} alt="BPCL" style={styles.navLogoImg} />
        ) : (
          <div style={styles.navMark}>BP</div>
        )}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <div style={styles.navTitle}>I-AuditNow</div>
            <span style={styles.livePulseDot} />
          </div>
          <div style={styles.navSub}>Live Status, Every Region</div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div style={styles.saveIndicator}>
          {saveStatus === "saving" && <><Loader2 className="spin" size={13} /> Saving…</>}
          {saveStatus === "saved" && <><Check size={13} color="#4C8577" /> Saved</>}
          {saveStatus === "error" && <span style={{ color: "#B0483F" }}>Save failed</span>}
          {saveStatus === "idle" && <span style={{ opacity: 0.45 }}>Synced</span>}
        </div>
        {user && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#9FB0C7", fontSize: 12 }}>
            <span className="hide-on-narrow">{user.email}</span>
            <button onClick={logOut} style={{ background: "transparent", border: "none", color: "#9FB0C7", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
              <LogOut size={13} />
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
function BottomNav({ screen, setScreen }) {
  const items = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "update", label: "Update", icon: ClipboardEdit },
    { id: "performance", label: "Performance", icon: TrendingUp },
    { id: "admin", label: "Setup", icon: Settings },
  ];
  return (
    <nav style={styles.bottomNav}>
      {items.map(({ id, label, icon: Icon }) => {
        const active = screen === id;
        return (
          <button key={id} onClick={() => setScreen(id)} style={styles.bottomNavBtn}>
            <Icon size={19} strokeWidth={active ? 2.4 : 2} color={active ? "#007BC9" : "#8A93A6"} />
            <span style={{ ...styles.bottomNavLabel, color: active ? "#007BC9" : "#8A93A6", fontWeight: active ? 700 : 500 }}>{label}</span>
            {active && <span style={styles.bottomNavDot} />}
          </button>
        );
      })}
    </nav>
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
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
          <div style={{ minWidth: 0 }}>
            <div style={styles.eyebrow}>Overview — All Regions</div>
            <h1 style={styles.h1}>Audit Status Ledger</h1>
          </div>
          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            <button onClick={() => generateCsv(state)} style={styles.iconActionBtn} title="Download Data (CSV)" aria-label="Download Data (CSV)">
              <Download size={15} color="#007BC9" />
            </button>
            <button onClick={() => generatePdfReport(state)} style={styles.iconActionBtn} title="Download PDF" aria-label="Download PDF">
              <FileStack size={15} color="#4C8577" />
            </button>
          </div>
        </div>
        <p style={styles.leadText}>
          {total} audits · {completed} closed · {ongoing} in progress
          {overdue > 0 && <> · <span style={{ color: "#B0483F", fontWeight: 600 }}>{overdue} overdue</span></>}
        </p>
      </div>
      <div style={styles.heroCard}>
        <StatusDonut total={total} completed={completed} ongoing={ongoing} notStarted={notStarted} compact />
        <div style={styles.heroStats}>
          <div style={styles.heroStatItem}>
            <span style={styles.heroStatLabel}>Overdue (90d+)</span>
            <span style={{ ...styles.heroStatValue, color: overdue > 0 ? "#B0483F" : "#8A93A6" }}>{overdue}</span>
          </div>
          <div style={styles.heroStatItem}>
            <span style={styles.heroStatLabel}>Avg Turnaround</span>
            <span style={{ ...styles.heroStatValue, color: "#8A6A00" }}>{avgCompletedDays !== null ? `${avgCompletedDays}d` : "—"}</span>
          </div>
        </div>
      </div>
      <QuarterlyTarget audits={audits} pos={state.pos} />
      <div>
        <div style={styles.sectionHeader}>Unit-wise Status <span style={{ fontWeight: 400, color: "#8A93A6", fontSize: 12 }}>— tap for details</span></div>
        <div style={styles.unitGrid}>
          {UNITS.map(u => <UnitCard key={u.id} unit={u} audits={audits.filter(a => effectiveRegion(a, state.pos) === u.id)} onOpen={() => setOpenUnitId(u.id === openUnitId ? null : u.id)} />)}
        </div>
      </div>
      {openUnitId && (
        <div ref={detailRef}>
          <UnitDetailPanel
            unit={UNITS.find(u => u.id === openUnitId)}
            audits={audits.filter(a => effectiveRegion(a, state.pos) === openUnitId)}
            onClose={() => setOpenUnitId(null)}
            overdueThresholdDays={overdueThresholdDays}
          />
        </div>
      )}
      <OverdueTable audits={audits} overdueThresholdDays={overdueThresholdDays} pos={state.pos} />
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
function StatusDonut({ total, completed, ongoing, notStarted, compact }) {
  const segments = [
    { name: "Completed", value: completed, color: "#4C8577" },
    { name: "In Progress", value: ongoing, color: "#007BC9" },
    { name: "Not Started", value: notStarted, color: "#C7CEDA" },
  ];
  const hasData = total > 0;
  const chartData = hasData ? segments.filter(s => s.value > 0) : [{ name: "No data", value: 1, color: "#EEF5FB" }];
  const size = compact ? 74 : 150;
  return (
    <div style={compact ? styles.donutCardCompact : styles.donutCard} className={compact ? "" : "card-hover"}>
      <div style={{ ...styles.donutChartWrap, width: size, height: size }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={chartData} dataKey="value" nameKey="name" innerRadius="68%" outerRadius="98%" paddingAngle={hasData ? 3 : 0} stroke="none" isAnimationActive={false}>
              {chartData.map((seg, i) => <Cell key={i} fill={seg.color} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div style={styles.donutCenter}>
          <div style={{ ...styles.donutCenterValue, fontSize: compact ? 17 : 28 }}>{total}</div>
          {!compact && <div style={styles.donutCenterLabel}>audits</div>}
        </div>
      </div>
      <div style={compact ? styles.donutLegendCompact : styles.donutLegend}>
        {!compact && <div style={styles.donutLegendTitle}>Status at a Glance</div>}
        {segments.map(s => <DonutLegendRow key={s.name} color={s.color} label={s.name} value={s.value} total={total} compact={compact} />)}
      </div>
    </div>
  );
}
function DonutLegendRow({ color, label, value, total, compact }) {
  const pct = total ? Math.round((value / total) * 100) : 0;
  return (
    <div style={{ ...styles.donutLegendRow, fontSize: compact ? 11.5 : 13 }}>
      <span style={{ width: compact ? 7 : 10, height: compact ? 7 : 10, borderRadius: 3, background: color, display: "inline-block", flexShrink: 0 }} />
      <span style={{ flex: 1, color: "#5A6478", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{compact ? label.replace("In Progress", "In Prog.") : label}</span>
      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, color: "#00456E" }}>{value}</span>
      {!compact && <span style={{ fontFamily: "'IBM Plex Mono', monospace", color: "#A3ABBB", fontSize: 11, width: 32, textAlign: "right" }}>{pct}%</span>}
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
function QuarterlyTarget({ audits, pos }) {
  const [regionFilter, setRegionFilter] = useState("ALL");
  const now = new Date();
  const { fyLabel, fyStartYear, q: currentQ } = fyQuarterInfo(now);
  // Region here means "the region this audit belongs to for review purposes" — the
  // same effectiveRegion() rule used everywhere else: the assigned PO's home region
  // if there is one, falling back to the audit's own unit tag otherwise.
  const regionAudits = regionFilter === "ALL" ? audits : audits.filter(a => effectiveRegion(a, pos) === regionFilter);
  // "In scope" is simply every audit currently in this region — the same total the
  // Unit-wise cards use. Earlier this narrowed to only audits whose Note Issue Date
  // fell inside the current FY window, which silently dropped anything noted just
  // before April 1st even if it was completed well within this FY — causing this
  // chart's % to disagree with the Unit-wise card's %. No more separate scoping.
  const totalPlanned = regionAudits.length;
  const quarterEnds = [
    new Date(fyStartYear, 5, 30),   // Q1 end Jun 30
    new Date(fyStartYear, 8, 30),   // Q2 end Sep 30
    new Date(fyStartYear, 11, 31),  // Q3 end Dec 31
    new Date(fyStartYear + 1, 2, 31), // Q4 end Mar 31
  ];
  const actualByQ = quarterEnds.map(end =>
    regionAudits.filter(a => a.finalPublishDate && new Date(a.finalPublishDate) <= end).length
  );
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
        <div style={{ ...styles.sectionHeader, marginBottom: 0 }}>Target vs Actual Completion — {fyLabel} <span style={{ fontWeight: 400, color: "#8A93A6", fontSize: 12 }}>(cumulative target {QUARTER_TARGETS.join("/")}% by quarter · {totalPlanned} in scope)</span></div>
        <select value={regionFilter} onChange={e => setRegionFilter(e.target.value)} style={{ ...styles.select, maxWidth: 180 }}>
          <option value="ALL">All regions</option>
          {UNITS.map(u => <option key={u.id} value={u.id}>{u.id} — {u.name}</option>)}
        </select>
      </div>
      <div style={styles.targetCard}>
        <div style={styles.quarterChartWrap}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={["Q1", "Q2", "Q3", "Q4"].map((label, i) => {
              const targetPct = QUARTER_TARGETS[i];
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
                  const targetPct = QUARTER_TARGETS[i];
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
          const targetPct = QUARTER_TARGETS[i];
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
  const inProgress = total - completed - notStarted;
  const pct = total ? Math.round((completed / total) * 100) : 0;
  // Backlog = how many of this unit's audits should have been closed by today at the
  // target pace, minus how many actually are — the shortfall against plan,
  // not just "everything that isn't finished yet".
  const expectedByNow = Math.round(total * expectedProgressFraction(new Date()));
  const backlog = Math.max(0, expectedByNow - completed);
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
        <DetailStat label="Backlog (vs. pace)" value={backlog} accent="#8A6A00" />
        <DetailStat label="In Progress" value={inProgress} accent="#007BC9" />
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
function OverdueTable({ audits, overdueThresholdDays, pos }) {
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
                <td style={styles.td}><UnitTag id={effectiveRegion(a, pos)} /></td>
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
    logSignIn(name).catch(() => {});
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
              {state.auditors.map(a => <option key={a.name} value={a.name}>{a.name}{a.unit ? ` (${a.unit})` : ""}</option>)}
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
          {myAudits.map(a => <option key={a.id} value={a.id}>{effectiveRegion(a, state.pos)} — {a.name}</option>)}
        </select>
      </Field>
      {myAudits.length === 0 && (
        <p style={styles.emptyNote}>Ask your admin to assign audits to you under Setup → Audits.</p>
      )}
      {audit && <AuditEditor key={audit.id} audit={audit} state={state} updateAudit={updateAudit} />}
    </div>
  );
}
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
const STAGE_DATE_FIELDS = ["noteIssueDate", "carScriptsRunDate", "preDraftDate", "darDiscussionDate", "darIssueDate", "concurrenceDate", "finalPublishDate"];
const STAGE_DATE_LABELS = {
  noteIssueDate: "Note Issue", carScriptsRunDate: "CAR Scripts Run",
  preDraftDate: "Pre-Draft", darDiscussionDate: "Post Audit Discussion",
  darIssueDate: "DAR Issue", concurrenceDate: "Concurrence", finalPublishDate: "Final Publish",
};
function findChronologyIssue(audit) {
  let lastLabel = null, lastDate = null;
  for (const field of STAGE_DATE_FIELDS) {
    const val = audit[field];
    if (!val) continue;
    const d = new Date(val);
    if (lastDate && d < lastDate) {
      return `${STAGE_DATE_LABELS[field]} date is earlier than ${lastLabel} date — double-check this is right.`;
    }
    lastDate = d; lastLabel = STAGE_DATE_LABELS[field];
  }
  return null;
}
function AuditEditor({ audit, state, updateAudit }) {
  const stageIdx = currentAuditStage(audit);
  const [futureDateWarning, setFutureDateWarning] = useState("");
  const today = todayISO();
  const handleDateChange = (field, value) => {
    if (value && value > today) {
      setFutureDateWarning(`${STAGE_DATE_LABELS[field] || "That"} date can't be in the future — it's been left unchanged.`);
      setTimeout(() => setFutureDateWarning(""), 4000);
      return; // blocked — future dates aren't allowed at all
    }
    updateAudit(audit.id, { [field]: value });
  };
  const chronologyWarning = findChronologyIssue(audit);
  return (
    <div style={styles.editorCard}>
      <div style={styles.editorHead}>
        <div>
          <div style={styles.editorTitle}>{audit.name}</div>
          <div style={styles.editorMeta}><UnitTag id={effectiveRegion(audit, state.pos)} /> · {UNITS.find(u => u.id === effectiveRegion(audit, state.pos))?.name}</div>
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
      {futureDateWarning && (
        <div style={styles.warningBanner}><AlertTriangle size={14} /> {futureDateWarning}</div>
      )}
      {!futureDateWarning && chronologyWarning && (
        <div style={styles.warningBanner}><AlertTriangle size={14} /> {chronologyWarning}</div>
      )}
      <div style={styles.formRow2}>
        <Field label="Audit Note Issue Date">
          <input type="date" max={today} value={audit.noteIssueDate || ""} onChange={e => handleDateChange("noteIssueDate", e.target.value)} style={styles.input} />
        </Field>
        <Field label="Pre-Draft Audit Report Date">
          <input type="date" max={today} value={audit.preDraftDate || ""} onChange={e => handleDateChange("preDraftDate", e.target.value)} style={styles.input} />
        </Field>
        <Field label="Post Audit Discussion Date">
          <input type="date" max={today} value={audit.darDiscussionDate || ""} onChange={e => handleDateChange("darDiscussionDate", e.target.value)} style={styles.input} />
        </Field>
        <Field label="DAR Issue Date">
          <input type="date" max={today} value={audit.darIssueDate || ""} onChange={e => handleDateChange("darIssueDate", e.target.value)} style={styles.input} />
        </Field>
        <Field label="Concurrence Date">
          <input type="date" max={today} value={audit.concurrenceDate || ""} onChange={e => handleDateChange("concurrenceDate", e.target.value)} style={styles.input} />
        </Field>
        <Field label="Final Audit Report Published">
          <input type="date" max={today} value={audit.finalPublishDate || ""} onChange={e => handleDateChange("finalPublishDate", e.target.value)} style={styles.input} />
        </Field>
      </div>
      <div style={styles.divider} />
      <div>
        <div style={styles.subHead}>Other Updates</div>
        <div style={{ ...styles.formRow2, marginTop: 10 }}>
          <Field label="Audit 360 Updation Date">
            <input type="date" max={today} value={audit.audit360UpdateDate || ""} onChange={e => handleDateChange("audit360UpdateDate", e.target.value)} style={styles.input} />
          </Field>
          <Field label="AWP Updation Date">
            <input type="date" max={today} value={audit.awpUpdateDate || ""} onChange={e => handleDateChange("awpUpdateDate", e.target.value)} style={styles.input} />
          </Field>
        </div>
      </div>
      <div style={styles.divider} />
      <Field label="CAR Scripts Run Date">
        <input type="date" max={today} value={audit.carScriptsRunDate || ""} onChange={e => handleDateChange("carScriptsRunDate", e.target.value)} style={{ ...styles.input, maxWidth: 260 }} />
      </Field>
      <LocationVisits audit={audit} updateAudit={updateAudit} today={today} />
      <div style={styles.divider} />
      <TrainingBlock audit={audit} updateAudit={updateAudit} today={today} />
      <div style={styles.divider} />
      <StockCheckBlock audit={audit} updateAudit={updateAudit} today={today} />
      <div style={styles.divider} />
      <SafBlock audit={audit} updateAudit={updateAudit} />
      <div style={styles.divider} />
      <RecommendationsBlock audit={audit} updateAudit={updateAudit} />
      <div style={styles.divider} />
      <SystemImprovementBlock audit={audit} updateAudit={updateAudit} />
    </div>
  );
}
function TrainingBlock({ audit, updateAudit, today }) {
  const trainingDone = !!audit.trainingDone;
  return (
    <div>
      <div style={styles.subHead}>Training</div>
      <label style={{ ...styles.checkboxRow, marginTop: 10 }}>
        <input
          type="checkbox"
          checked={trainingDone}
          onChange={e => updateAudit(audit.id, { trainingDone: e.target.checked, ...(e.target.checked ? {} : { trainingDate: "" }) })}
          style={styles.checkbox}
        />
        <span style={styles.checkboxLabel}>Training Done</span>
      </label>
      {trainingDone && (
        <div style={{ marginTop: 10, maxWidth: 260 }} className="fade-row">
          <Field label="Training Date">
            <input
              type="date"
              max={today}
              value={audit.trainingDate || ""}
              onChange={e => {
                if (e.target.value && e.target.value > today) return;
                updateAudit(audit.id, { trainingDate: e.target.value });
              }}
              style={styles.input}
            />
          </Field>
        </div>
      )}
    </div>
  );
}
function StockCheckBlock({ audit, updateAudit, today }) {
  const done = !!audit.stockCheckDone;
  return (
    <div>
      <div style={styles.subHead}>HC / NHC Stock Check</div>
      <label style={{ ...styles.checkboxRow, marginTop: 10 }}>
        <input
          type="checkbox"
          checked={done}
          onChange={e => updateAudit(audit.id, {
            stockCheckDone: e.target.checked,
            ...(e.target.checked ? {} : { stockCheckDate: "" }),
          })}
          style={styles.checkbox}
        />
        <span style={styles.checkboxLabel}>HC / NHC stock check done</span>
      </label>
      {done && (
        <div style={{ marginTop: 10, maxWidth: 260 }} className="fade-row">
          <Field label="Stock Check Date">
            <input
              type="date"
              max={today}
              value={audit.stockCheckDate || ""}
              onChange={e => {
                if (e.target.value && e.target.value > today) return; // future dates blocked, same rule as Training
                updateAudit(audit.id, { stockCheckDate: e.target.value });
              }}
              style={styles.input}
            />
          </Field>
        </div>
      )}
    </div>
  );
}
function SafBlock({ audit, updateAudit }) {
  const hasSAF = !!audit.hasSAF;
  return (
    <div>
      <div style={styles.subHead}>SAF (Serious Audit Findings)</div>
      <label style={{ ...styles.checkboxRow, marginTop: 10 }}>
        <input
          type="checkbox"
          checked={hasSAF}
          onChange={e => updateAudit(audit.id, { hasSAF: e.target.checked, ...(e.target.checked ? {} : { safCount: "" }) })}
          style={styles.checkbox}
        />
        <span style={styles.checkboxLabel}>This audit has SAF(s)</span>
      </label>
      {hasSAF && (
        <div style={{ marginTop: 10, maxWidth: 200 }} className="fade-row">
          <Field label="No. of SAFs">
            <input
              type="number"
              min="0"
              value={audit.safCount ?? ""}
              onChange={e => updateAudit(audit.id, { safCount: e.target.value === "" ? "" : Math.max(0, Number(e.target.value)) })}
              style={styles.input}
            />
          </Field>
        </div>
      )}
    </div>
  );
}
function RecommendationsBlock({ audit, updateAudit }) {
  const total = Number(audit.recommendationsTotal) || 0;
  const sinceDone = Number(audit.recommendationsSinceDone) || 0;
  const atrClosed = Number(audit.recommendationsAtrClosed) || 0;
  const balance = Math.max(0, total - sinceDone - atrClosed);
  return (
    <div>
      <div style={styles.subHead}>Recommendations</div>
      <div style={{ ...styles.formRow2, marginTop: 10 }}>
        <Field label="No. of Recommendations">
          <input
            type="number"
            min="0"
            value={audit.recommendationsTotal ?? ""}
            onChange={e => updateAudit(audit.id, { recommendationsTotal: e.target.value === "" ? "" : Math.max(0, Number(e.target.value)) })}
            style={styles.input}
          />
        </Field>
        <Field label="Since Done">
          <input
            type="number"
            min="0"
            value={audit.recommendationsSinceDone ?? ""}
            onChange={e => updateAudit(audit.id, { recommendationsSinceDone: e.target.value === "" ? "" : Math.max(0, Number(e.target.value)) })}
            style={styles.input}
          />
        </Field>
        <Field label="ATR Closed">
          <input
            type="number"
            min="0"
            value={audit.recommendationsAtrClosed ?? ""}
            onChange={e => updateAudit(audit.id, { recommendationsAtrClosed: e.target.value === "" ? "" : Math.max(0, Number(e.target.value)) })}
            style={styles.input}
          />
        </Field>
        <Field label="Balance Recommendations">
          <div style={styles.readOnlyPill}>{balance}</div>
        </Field>
      </div>
      <p style={{ fontSize: 11.5, color: "#A3ABBB", margin: "8px 0 0" }}>
        "ATR Closed" can be updated any time — including after the report is published — as ATR compliance comes in from the auditee. Balance recalculates automatically.
      </p>
    </div>
  );
}
function SystemImprovementBlock({ audit, updateAudit }) {
  const has = !!audit.hasSystemImprovement;
  return (
    <div>
      <div style={styles.subHead}>System / Process Improvement</div>
      <label style={{ ...styles.checkboxRow, marginTop: 10 }}>
        <input
          type="checkbox"
          checked={has}
          onChange={e => updateAudit(audit.id, { hasSystemImprovement: e.target.checked, ...(e.target.checked ? {} : { systemImprovementText: "" }) })}
          style={styles.checkbox}
        />
        <span style={styles.checkboxLabel}>Any system / process improvement identified</span>
      </label>
      {has && (
        <div style={{ marginTop: 10 }} className="fade-row">
          <Field label="Briefly describe the improvement">
            <textarea
              value={audit.systemImprovementText || ""}
              onChange={e => updateAudit(audit.id, { systemImprovementText: e.target.value })}
              style={styles.textarea}
              rows={3}
              placeholder="e.g. Automated the reconciliation step to remove manual entry errors…"
            />
          </Field>
        </div>
      )}
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
function LocationVisits({ audit, updateAudit, today }) {
  const visits = audit.locationVisits || [];
  const addVisit = () => {
    updateAudit(audit.id, { locationVisits: [...visits, { id: uid(), type: LOCATION_TYPES[0], startDate: "", endDate: "" }] });
  };
  const patchVisit = (vid, patch) => {
    updateAudit(audit.id, { locationVisits: visits.map(v => v.id === vid ? { ...v, ...patch } : v) });
  };
  const removeVisit = (vid) => {
    updateAudit(audit.id, { locationVisits: visits.filter(v => v.id !== vid) });
  };
  const handleVisitDate = (vid, field, value) => {
    if (value && value > today) return; // future dates blocked, silently ignored here — same rule as the main dates
    patchVisit(vid, { [field]: value });
  };
  return (
    <div>
      <div style={styles.subHeadRow}>
        <span style={styles.subHead}><MapPin size={14} style={{ marginRight: 5, verticalAlign: -2 }} />Location Visits</span>
        <button onClick={addVisit} style={styles.smallBtn}><Plus size={13} /> Add visit</button>
      </div>
      {visits.length === 0 && <div style={styles.emptyNote}>No location visits recorded. Add one if this audit involves site visits.</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {visits.map(v => {
          // Older visits saved before this update only have a single "date" field —
          // shown as the start date so nothing is lost.
          const startDate = v.startDate !== undefined ? v.startDate : (v.date || "");
          const endDate = v.endDate || "";
          const rangeIssue = startDate && endDate && endDate < startDate;
          return (
            <div key={v.id} style={{ display: "flex", flexDirection: "column", gap: 6 }} className="fade-row">
              <div style={styles.visitRow}>
                <select value={v.type} onChange={e => patchVisit(v.id, { type: e.target.value })} style={{ ...styles.select, flex: 1.3 }}>
                  {LOCATION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <input type="date" max={today} value={startDate} placeholder="Start" onChange={e => handleVisitDate(v.id, "startDate", e.target.value)} style={{ ...styles.input, flex: 1 }} />
                <input type="date" max={today} value={endDate} placeholder="End" onChange={e => handleVisitDate(v.id, "endDate", e.target.value)} style={{ ...styles.input, flex: 1 }} />
                <button onClick={() => removeVisit(v.id)} style={styles.iconBtn}><Trash2 size={14} color="#B0483F" /></button>
              </div>
              {rangeIssue && <div style={{ ...styles.warningBanner, fontSize: 11.5 }}><AlertTriangle size={12} /> End date is before the start date — double-check this visit.</div>}
            </div>
          );
        })}
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
  const [regionFilter, setRegionFilter] = useState("ALL");
  const now = new Date();
  const { fyLabel, fyStartYear } = fyQuarterInfo(now);
  const quarterRanges = [
    { label: "Q1", start: new Date(fyStartYear, 3, 1), end: new Date(fyStartYear, 5, 30) },
    { label: "Q2", start: new Date(fyStartYear, 6, 1), end: new Date(fyStartYear, 8, 30) },
    { label: "Q3", start: new Date(fyStartYear, 9, 1), end: new Date(fyStartYear, 11, 31) },
    { label: "Q4", start: new Date(fyStartYear + 1, 0, 1), end: new Date(fyStartYear + 1, 2, 31) },
  ];
  const visibleAuditors = regionFilter === "ALL" ? state.auditors : state.auditors.filter(p => p.unit === regionFilter);
  const rows = useMemo(() => visibleAuditors.map(p => {
    const name = p.name;
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
    const safTotal = mine.reduce((s, a) => s + (a.hasSAF ? (Number(a.safCount) || 0) : 0), 0);
    const recommendationsTotal = mine.reduce((s, a) => s + (Number(a.recommendationsTotal) || 0), 0);
    const recommendationsSinceDone = mine.reduce((s, a) => s + (Number(a.recommendationsSinceDone) || 0), 0);
    const recommendationsAtrClosed = mine.reduce((s, a) => s + (Number(a.recommendationsAtrClosed) || 0), 0);
    const recommendationsBalance = Math.max(0, recommendationsTotal - recommendationsSinceDone - recommendationsAtrClosed);
    const improvementsAudits = mine.filter(a => a.hasSystemImprovement && a.systemImprovementText);
    const improvementsCount = improvementsAudits.length;
    return {
      name, unit: p.unit, total, completed, inProgress, notStarted, overdue, avg, pct, quarters, audits: mine,
      safTotal, recommendationsTotal, recommendationsSinceDone, recommendationsAtrClosed, recommendationsBalance, improvementsCount, improvementsAudits,
    };
  }).sort((a, b) => b.total - a.total), [visibleAuditors, state.audits]);
  const unassigned = state.audits.filter(a => !a.auditor).length;
  const grandTotalRecommendations = rows.reduce((s, r) => s + r.recommendationsTotal, 0);
  const grandTotalSAF = rows.reduce((s, r) => s + r.safTotal, 0);
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
      <Field label="Filter by region">
        <select value={regionFilter} onChange={e => setRegionFilter(e.target.value)} style={{ ...styles.select, maxWidth: 260 }}>
          <option value="ALL">All regions</option>
          {UNITS.map(u => <option key={u.id} value={u.id}>{u.id} — {u.name}</option>)}
        </select>
      </Field>
      <div style={styles.perfStatRow}>
        <DetailStat label={`Recommendations — ${fyLabel}`} value={grandTotalRecommendations} accent="#00456E" />
        <DetailStat label="Total SAFs" value={grandTotalSAF} accent="#B0483F" />
      </div>
      {rows.length === 0 && <p style={styles.emptyNote}>No auditors match this filter yet.</p>}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {rows.map(r => {
          const isOpen = openAuditor === r.name;
          return (
            <div key={r.name} style={styles.perfCard} className="card-hover">
              <button type="button" onClick={() => setOpenAuditor(isOpen ? null : r.name)} style={styles.perfCardHead}>
                <div style={{ textAlign: "left" }}>
                  <div style={styles.perfName}>{r.name} {r.unit && <span style={{ fontWeight: 400, fontSize: 11.5, color: "#8A93A6" }}>· {r.unit}</span>}</div>
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
                  <div style={styles.perfStatRow}>
                    <DetailStat label="SAFs" value={r.safTotal} accent="#B0483F" />
                    <DetailStat label="Recommendations" value={r.recommendationsTotal} accent="#00456E" />
                    <DetailStat label="Since Done" value={r.recommendationsSinceDone} accent="#4C8577" />
                    <DetailStat label="ATR Closed" value={r.recommendationsAtrClosed} accent="#007BC9" />
                    <DetailStat label="Balance" value={r.recommendationsBalance} accent="#8A6A00" />
                    <DetailStat label="Improvements" value={r.improvementsCount} accent="#007BC9" />
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
                            <div style={{ fontSize: 11.5, color: "#8A93A6", marginTop: 2 }}><UnitTag id={effectiveRegion(a, state.pos)} /> · {a.po ? `PO: ${a.po}` : "no PO assigned"}</div>
                          </div>
                          <StageBadge stageIdx={stageIdx} />
                        </div>
                      );
                    })}
                  </div>
                  {r.improvementsAudits.length > 0 && (
                    <>
                      <div style={styles.detailListTitle}>System / Process Improvements</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {r.improvementsAudits.map(a => (
                          <div key={a.id} style={styles.entityRow}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 600, fontSize: 13.5, color: "#00456E" }}>{a.name}</div>
                              <div style={{ fontSize: 12.5, color: "#5A6478", marginTop: 3 }}>{a.systemImprovementText}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
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
  const { audits, auditors, pos } = state;
  const total = audits.length;
  const completed = audits.filter(isComplete).length;
  const notStarted = audits.filter(a => currentAuditStage(a) === -1).length;
  const ongoing = total - completed - notStarted;
  const now = new Date();
  const { fyLabel, fyStartYear, q: currentQ } = fyQuarterInfo(now);
  const totalPlanned = total; // same total the unit-wise table below uses — no separate FY-note-date scoping
  const quarterEnds = [new Date(fyStartYear, 5, 30), new Date(fyStartYear, 8, 30), new Date(fyStartYear, 11, 31), new Date(fyStartYear + 1, 2, 31)];
  const unitRows = UNITS.map(u => {
    const ua = audits.filter(a => effectiveRegion(a, pos) === u.id);
    const uc = ua.filter(isComplete).length;
    const uns = ua.filter(a => currentAuditStage(a) === -1).length;
    const active = ua.length - uc - uns;
    const done = ua.filter(a => isComplete(a) && a.noteIssueDate);
    const avg = done.length ? Math.round(done.reduce((s, a) => s + daysBetween(a.noteIssueDate, a.finalPublishDate), 0) / done.length) : null;
    return { ...u, total: ua.length, completed: uc, active, notStarted: uns, avg, pct: ua.length ? Math.round((uc / ua.length) * 100) : 0 };
  });
  const auditorRows = auditors.map(p => {
    const mine = audits.filter(a => a.auditor === p.name);
    const c = mine.filter(isComplete).length;
    const safTotal = mine.reduce((s, a) => s + (a.hasSAF ? (Number(a.safCount) || 0) : 0), 0);
    const recTotal = mine.reduce((s, a) => s + (Number(a.recommendationsTotal) || 0), 0);
    return { name: p.name, total: mine.length, completed: c, pct: mine.length ? Math.round((c / mine.length) * 100) : 0, safTotal, recTotal };
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
            const targetPct = QUARTER_TARGETS[i];
            const actualCount = audits.filter(a => a.finalPublishDate && new Date(a.finalPublishDate) <= quarterEnds[i]).length;
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
            <thead><tr>{["Auditor", "Assigned", "Completed", "% Complete", "SAFs", "Recommendations"].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
            <tbody>
              {auditorRows.map(r => (
                <tr key={r.name}><td style={td}>{r.name}</td><td style={td}>{r.total}</td><td style={td}>{r.completed}</td><td style={td}>{r.pct}%</td><td style={td}>{r.safTotal}</td><td style={td}>{r.recTotal}</td></tr>
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
                <td style={td}>{effectiveRegion(a, pos)}</td><td style={td}>{a.name}</td><td style={td}>{a.auditor || "—"}</td>
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
        <button onClick={() => setTab("bulkstatus")} style={{ ...styles.subNavBtn, ...(tab === "bulkstatus" ? styles.subNavBtnActive : {}) }}><Upload size={14} /> Bulk Status</button>
        <button onClick={() => setTab("auditors")} style={{ ...styles.subNavBtn, ...(tab === "auditors" ? styles.subNavBtnActive : {}) }}><Users size={14} /> Auditors</button>
        <button onClick={() => setTab("pos")} style={{ ...styles.subNavBtn, ...(tab === "pos" ? styles.subNavBtnActive : {}) }}><UserSquare2 size={14} /> POs</button>
        <button onClick={() => setTab("log")} style={{ ...styles.subNavBtn, ...(tab === "log" ? styles.subNavBtnActive : {}) }}><Clock size={14} /> Sign-in Log</button>
      </div>
      {tab === "audits" && <AuditsAdmin state={state} persist={persist} />}
      {tab === "bulkstatus" && <BulkStatusUpdate state={state} persist={persist} />}
      {tab === "auditors" && <NameListAdmin listKey="auditors" title="Auditor Roster" state={state} persist={persist} />}
      {tab === "pos" && <NameListAdmin listKey="pos" title="Process Owner (PO) Roster" state={state} persist={persist} />}
      {tab === "log" && <SignInLogPanel />}
    </div>
  );
}
// Accepts DD-MM-YYYY, DD/MM/YYYY, YYYY-MM-DD, or things like "21 Aug 2026".
// Returns { ok: true, value: "YYYY-MM-DD" } | { ok: false } for unparseable text
// | null for a genuinely blank cell (meaning "leave this field untouched").
function isRealDate(y, mo, d) {
  const dt = new Date(Number(y), Number(mo) - 1, Number(d));
  return dt.getFullYear() === Number(y) && dt.getMonth() === Number(mo) - 1 && dt.getDate() === Number(d);
}
function parseFlexibleDate(raw) {
  const s = (raw || "").trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) {
    const [, y, mo, d] = m;
    if (!isRealDate(y, mo, d)) return { ok: false };
    return { ok: true, value: `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}` };
  }
  m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (m) {
    const [, d, mo, y] = m;
    if (!isRealDate(y, mo, d)) return { ok: false };
    return { ok: true, value: `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}` };
  }
  const parsed = new Date(s);
  if (!isNaN(parsed)) {
    // Use local date parts, not toISOString() — that converts through UTC and
    // would silently shift the date back by a day for anyone in IST.
    const y = parsed.getFullYear(), mo = String(parsed.getMonth() + 1).padStart(2, "0"), d = String(parsed.getDate()).padStart(2, "0");
    return { ok: true, value: `${y}-${mo}-${d}` };
  }
  return { ok: false };
}
function BulkStatusUpdate({ state, persist }) {
  const [unit, setUnit] = useState(UNITS[0].id);
  const [pasteText, setPasteText] = useState("");
  const [result, setResult] = useState(null);
  const today = todayISO();
  const STAGE_COLS = ["noteIssueDate", "preDraftDate", "darDiscussionDate", "darIssueDate", "finalPublishDate"];
  const STAGE_COL_LABELS = ["Note Issue", "Pre-Draft", "DAR Discussion", "DAR Issue", "Final Publish"];
  const applyUpdate = () => {
    const lines = pasteText.split("\n").map(l => l.trim()).filter(Boolean);
    if (!lines.length) return;
    const audits = [...state.audits];
    let updated = 0;
    const notFound = [];
    const skippedDates = []; // { audit, field, reason }
    const chronologyFlags = [];
    for (const line of lines) {
      const cells = line.split("\t").map(c => c.trim());
      const name = cells[0] || "";
      if (!name) continue;
      const idx = audits.findIndex(a => effectiveRegion(a, state.pos) === unit && a.name === name);
      if (idx === -1) { notFound.push(name); continue; }
      const patch = {};
      STAGE_COLS.forEach((field, i) => {
        const parsed = parseFlexibleDate(cells[i + 1]);
        if (parsed === null) return; // blank cell — leave this field alone
        if (!parsed.ok) { skippedDates.push({ audit: name, field: STAGE_COL_LABELS[i], reason: "couldn't read that date" }); return; }
        if (parsed.value > today) { skippedDates.push({ audit: name, field: STAGE_COL_LABELS[i], reason: "is a future date, not allowed" }); return; }
        patch[field] = parsed.value;
      });
      if (Object.keys(patch).length === 0) continue;
      const merged = { ...audits[idx], ...patch };
      const chronologyIssue = findChronologyIssue(merged);
      if (chronologyIssue) chronologyFlags.push({ audit: name, issue: chronologyIssue });
      audits[idx] = merged;
      updated++;
    }
    if (updated > 0) persist({ ...state, audits });
    setResult({ updated, notFound, skippedDates, chronologyFlags });
    setPasteText("");
  };
  return (
    <div style={styles.panel}>
      <div style={styles.panelTitle}>Bulk Status Update</div>
      <p style={{ fontSize: 12, color: "#8A93A6", marginTop: -8, marginBottom: 14 }}>
        Backfill or catch up milestone dates for many existing audits in one paste — matched by exact audit name within the unit you pick below.
        Leave a date blank to leave that field untouched; existing values you don't include are kept as-is.
      </p>
      <Field label="Unit">
        <select value={unit} onChange={e => setUnit(e.target.value)} style={{ ...styles.select, maxWidth: 280 }}>
          {UNITS.map(u => <option key={u.id} value={u.id}>{u.id} — {u.name}</option>)}
        </select>
      </Field>
      <div style={{ marginTop: 12 }}>
        <textarea
          value={pasteText}
          onChange={e => setPasteText(e.target.value)}
          placeholder={"One audit per line, tab-separated:\nAudit Name<TAB>Note Issue<TAB>Pre-Draft<TAB>DAR Discussion<TAB>DAR Issue<TAB>Final Publish\n\nLeave a date blank to skip it. Dates can be DD-MM-YYYY, YYYY-MM-DD, or like \"21 Aug 2026\".\nCopy straight from a 6-column Excel selection (audit name must match exactly, including punctuation)."}
          style={styles.textarea}
          rows={8}
        />
        <button onClick={applyUpdate} style={{ ...styles.primaryBtnSm, marginTop: 8 }}><Upload size={13} /> Apply Update</button>
      </div>
      {result && (
        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={styles.warningBanner}>
            <Check size={14} /> {result.updated} audit{result.updated !== 1 ? "s" : ""} updated.
          </div>
          {result.notFound.length > 0 && (
            <div style={{ ...styles.warningBanner, background: "#FBE7E4", color: "#B0483F", borderColor: "#F0C4BC" }}>
              <AlertTriangle size={14} />
              <span>No exact match in {unit} for: {result.notFound.join(", ")} — check spelling matches Setup → Audits exactly.</span>
            </div>
          )}
          {result.skippedDates.length > 0 && (
            <div style={{ ...styles.warningBanner, background: "#FBF1E1", color: "#8A6A00" }}>
              <AlertTriangle size={14} />
              <span>{result.skippedDates.map(s => `${s.audit} — ${s.field} ${s.reason}`).join("; ")}</span>
            </div>
          )}
          {result.chronologyFlags.length > 0 && (
            <div style={{ ...styles.warningBanner, background: "#FBF1E1", color: "#8A6A00" }}>
              <AlertTriangle size={14} />
              <span>{result.chronologyFlags.map(c => `${c.audit}: ${c.issue}`).join("; ")}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
function SignInLogPanel() {
  const [entries, setEntries] = useState(null);
  useEffect(() => {
    const unsub = watchSignInLog(setEntries);
    return unsub;
  }, []);
  const fmtWhen = (at) => {
    if (!at) return "—";
    const d = at.toDate ? at.toDate() : new Date(at);
    return d.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  };
  return (
    <div style={styles.panel}>
      <div style={styles.panelTitle}>Sign-in Log</div>
      <p style={{ fontSize: 12, color: "#8A93A6", marginTop: -8, marginBottom: 14 }}>
        Every time someone opens the shared login or picks their name on Update Audit, it's recorded here — last 100 entries, most recent first.
        Since everyone shares one login, "who signed in" is really "who identified themselves" — someone could type another name, so treat this as a helpful trail, not proof.
      </p>
      {entries === null && <div style={styles.emptyNote}>Loading…</div>}
      {entries && entries.length === 0 && <div style={styles.emptyNote}>No sign-ins recorded yet.</div>}
      {entries && entries.length > 0 && (
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead><tr><th style={styles.th}>Name</th><th style={styles.th}>When</th></tr></thead>
            <tbody>
              {entries.map(e => (
                <tr key={e.id} className="fade-row">
                  <td style={styles.td}>{e.name}</td>
                  <td style={{ ...styles.td, fontFamily: "'IBM Plex Mono', monospace" }}>{fmtWhen(e.at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
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
    const auditorMap = new Map(state.auditors.map(p => [p.name, p]));
    const poMap = new Map(state.pos.map(p => [p.name, p]));
    const newAudits = lines.map(line => {
      // Prefer splitting on tabs if any are present (paste from Excel, or our own
      // generated import blocks) — this avoids breaking on commas that are part of
      // the audit name itself (e.g. "...Other than ITC, including Auto-matching...").
      // Only fall back to comma-splitting for simple, tab-free single-line pastes.
      const parts = line.includes("\t") ? line.split("\t") : line.split(",");
      const [name = "", auditor = "", po = ""] = parts.map(s => s.trim());
      // New names picked up here get tagged with the unit being imported into —
      // matches how you're actually organising people (region-specific rosters).
      if (auditor && !auditorMap.has(auditor)) auditorMap.set(auditor, { name: auditor, unit });
      if (po && !poMap.has(po)) poMap.set(po, { name: po, unit });
      return {
        id: uid(), name, unit, auditor, po,
        noteIssueDate: "", locationVisits: [], preDraftDate: "",
        darDiscussionDate: "", darIssueDate: "", finalPublishDate: "",
        createdAt: new Date().toISOString(),
      };
    }).filter(a => a.name);
    if (!newAudits.length) return;
    persist({ ...state, audits: [...state.audits, ...newAudits], auditors: Array.from(auditorMap.values()), pos: Array.from(poMap.values()) });
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
  const grouped = UNITS.map(u => ({ unit: u, audits: state.audits.filter(a => effectiveRegion(a, state.pos) === u.id) }));
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
  // Anyone can be assigned to any region's audit now — auditors and POs regularly
  // cover other regions. People from this unit are listed first for convenience,
  // and each option shows its home region so it's clear who's local vs. covering.
  const sortByHome = (list) => [...list].sort((a, b) => {
    const aHome = a.unit === unit.id ? 0 : 1;
    const bHome = b.unit === unit.id ? 0 : 1;
    return aHome - bHome || a.name.localeCompare(b.name);
  });
  const sortedAuditors = sortByHome(auditors);
  const sortedPos = sortByHome(pos);
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
                {sortedAuditors.map(p => <option key={p.name} value={p.name}>{p.name}{p.unit ? ` (${p.unit})` : ""}</option>)}
              </select>
              <select value={a.po || ""} onChange={e => assignAudit(a.id, { po: e.target.value })} style={{ ...styles.select, ...styles.assignSelect }}>
                <option value="">Assign PO…</option>
                {sortedPos.map(p => <option key={p.name} value={p.name}>{p.name}{p.unit ? ` (${p.unit})` : ""}</option>)}
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
  const [singleUnit, setSingleUnit] = useState("");
  const [pasteUnit, setPasteUnit] = useState("");
  const list = state[listKey];
  const addSingle = () => {
    const v = single.trim();
    if (!v || list.some(p => p.name === v)) return;
    persist({ ...state, [listKey]: [...list, { name: v, unit: singleUnit }] });
    setSingle("");
  };
  const importPasted = () => {
    const names = pasteText.split("\n").map(s => s.trim()).filter(Boolean);
    const map = new Map(list.map(p => [p.name, p]));
    names.forEach(n => { if (!map.has(n)) map.set(n, { name: n, unit: pasteUnit }); });
    persist({ ...state, [listKey]: Array.from(map.values()) });
    setPasteText("");
  };
  const remove = (name) => persist({ ...state, [listKey]: list.filter(p => p.name !== name) });
  const updateUnit = (name, newUnit) => persist({ ...state, [listKey]: list.map(p => p.name === name ? { ...p, unit: newUnit } : p) });
  return (
    <div style={styles.panel}>
      <div style={styles.panelTitle}>{title}</div>
      <p style={{ fontSize: 12, color: "#8A93A6", marginTop: -8, marginBottom: 14 }}>
        Set each person's region so they only show up as an option for that region's audits. Leave blank or choose HQ for someone who covers everywhere.
      </p>
      <div style={styles.formRow2}>
        <div style={{ display: "flex", gap: 8 }}>
          <input value={single} onChange={e => setSingle(e.target.value)} placeholder="Add a name" style={{ ...styles.input, flex: 1 }}
            onKeyDown={e => e.key === "Enter" && addSingle()} />
          <select value={singleUnit} onChange={e => setSingleUnit(e.target.value)} style={{ ...styles.select, width: 90 }}>
            <option value="">Region…</option>
            {UNITS.map(u => <option key={u.id} value={u.id}>{u.id}</option>)}
          </select>
          <button onClick={addSingle} style={styles.primaryBtnSm}><Plus size={14} /></button>
        </div>
      </div>
      <div style={{ marginTop: 14 }}>
        <textarea value={pasteText} onChange={e => setPasteText(e.target.value)} placeholder={"Or paste multiple names, one per line"} style={styles.textarea} rows={3} />
        <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center" }}>
          <select value={pasteUnit} onChange={e => setPasteUnit(e.target.value)} style={{ ...styles.select, width: 140 }}>
            <option value="">All go to: (none)</option>
            {UNITS.map(u => <option key={u.id} value={u.id}>All go to: {u.id}</option>)}
          </select>
          <button onClick={importPasted} style={styles.primaryBtnSm}><Upload size={13} /> Import list</button>
        </div>
      </div>
      <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 8 }}>
        {list.length === 0 && <div style={styles.emptyNote}>No names added yet.</div>}
        {list.map(p => (
          <div key={p.name} style={styles.rosterRow}>
            <span style={{ flex: 1, fontSize: 13.5 }}>{p.name}</span>
            <select value={p.unit || ""} onChange={e => updateUnit(p.name, e.target.value)} style={{ ...styles.select, ...styles.assignSelect, maxWidth: 130 }}>
              <option value="">No region set</option>
              {UNITS.map(u => <option key={u.id} value={u.id}>{u.id} — {u.name}</option>)}
            </select>
            <button onClick={() => remove(p.name)} style={styles.iconBtn}><Trash2 size={13} color="#B0483F" /></button>
          </div>
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
  main: { maxWidth: 1180, margin: "0 auto", padding: "18px 18px calc(84px + env(safe-area-inset-bottom, 0px))" },
  nav: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "10px 16px", background: "#00456E", position: "sticky", top: 0, zIndex: 20,
    boxShadow: "0 1px 0 rgba(0,0,0,0.08)", gap: 10,
  },
  navBrand: { display: "flex", alignItems: "center", gap: 10, minWidth: 0 },
  navMark: {
    width: 30, height: 30, borderRadius: 7, background: "#FFE000", color: "#00456E",
    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
    fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: 12, letterSpacing: 0.5,
  },
  navLogoImg: { height: 30, width: "auto", maxWidth: 96, objectFit: "contain", background: "#fff", borderRadius: 7, padding: "2px 5px", flexShrink: 0 },
  navTitle: { color: "#fff", fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 15, lineHeight: 1.1 },
  navSub: { color: "#9FB0C7", fontSize: 10.5, marginTop: 1 },
  livePulseDot: { width: 6, height: 6, borderRadius: "50%", background: "#4C8577", display: "inline-block", boxShadow: "0 0 0 rgba(76,133,119,0.6)", animation: "livePulse 2s infinite", flexShrink: 0 },
  saveIndicator: { color: "#9FB0C7", fontSize: 11.5, display: "flex", alignItems: "center", gap: 5 },
  bottomNav: {
    position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 30,
    display: "flex", background: "#fff", borderTop: "1px solid #E2E6ED",
    boxShadow: "0 -2px 12px rgba(16,35,63,0.08)",
    paddingBottom: "env(safe-area-inset-bottom, 0px)",
  },
  bottomNavBtn: {
    flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
    padding: "9px 4px 8px", background: "transparent", border: "none", cursor: "pointer", position: "relative",
  },
  bottomNavLabel: { fontSize: 10.5, letterSpacing: 0.1 },
  bottomNavDot: { position: "absolute", top: 4, width: 4, height: 4, borderRadius: "50%", background: "#007BC9" },
  eyebrow: { fontSize: 11, letterSpacing: 1.3, textTransform: "uppercase", color: "#007BC9", fontWeight: 600, marginBottom: 4 },
  h1: { fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 25, margin: 0, color: "#00456E" },
  leadText: { color: "#5A6478", fontSize: 13, marginTop: 6, maxWidth: 640, lineHeight: 1.45 },
  sectionHeader: { fontFamily: "'Fraunces', serif", fontSize: 15, fontWeight: 600, color: "#00456E", marginBottom: 10 },
  statRow: { display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 },
  statTile: { background: "#fff", border: "1px solid #E2E6ED", borderRadius: 10, padding: "10px 12px" },
  statLabel: { fontSize: 10, color: "#8A93A6", fontWeight: 500, textTransform: "uppercase", letterSpacing: 0.3 },
  statValue: { fontFamily: "'IBM Plex Mono', monospace", fontSize: 21, fontWeight: 600, marginTop: 3 },
  statSub: { fontSize: 9.5, color: "#A3ABBB", marginTop: 2 },
  targetCard: { background: "#fff", border: "1px solid #E2E6ED", borderRadius: 10, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 },
  quarterChartWrap: { width: "100%", height: 190 },
  quarterChartLegend: { display: "flex", gap: 16, flexWrap: "wrap", paddingBottom: 4, borderBottom: "1px solid #EEF0F4" },
  donutCard: { background: "#fff", border: "1px solid #E2E6ED", borderRadius: 12, padding: "18px 20px", display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap", justifyContent: "center" },
  donutCardCompact: { display: "flex", alignItems: "center", gap: 14, flex: 1, minWidth: 0 },
  donutLegendCompact: { display: "flex", flexDirection: "column", gap: 5, flex: 1, minWidth: 0 },
  heroCard: { background: "#fff", border: "1px solid #E2E6ED", borderRadius: 12, padding: "14px 16px", display: "flex", alignItems: "center", gap: 14 },
  heroStats: { display: "flex", flexDirection: "column", gap: 8, borderLeft: "1px solid #EFF3F8", paddingLeft: 14, flexShrink: 0 },
  heroStatItem: { display: "flex", flexDirection: "column" },
  heroStatLabel: { fontSize: 9.5, color: "#8A93A6", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.3, whiteSpace: "nowrap" },
  heroStatValue: { fontFamily: "'IBM Plex Mono', monospace", fontSize: 17, fontWeight: 600 },
  iconActionBtn: { width: 34, height: 34, borderRadius: 8, border: "1px solid #E2E6ED", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" },
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
  unitGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 10 },
  unitCard: { background: "#fff", border: "1px solid #E2E6ED", borderRadius: 10, padding: "12px 14px" },
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
  warningBanner: { display: "flex", alignItems: "center", gap: 8, background: "#FBF1E1", color: "#8A6A00", border: "1px solid #F0DCA8", borderRadius: 8, padding: "9px 12px", fontSize: 12.5, fontWeight: 500 },
  input: { padding: "9px 10px", borderRadius: 7, border: "1px solid #D6DAE2", background: "#fff", fontSize: 13.5, color: "#1C2733", outline: "none", fontFamily: "'IBM Plex Mono', monospace" },
  textarea: { width: "100%", padding: "10px 12px", borderRadius: 7, border: "1px solid #D6DAE2", fontSize: 13, resize: "vertical", outline: "none" },
  checkboxRow: { display: "flex", alignItems: "center", gap: 9, cursor: "pointer" },
  checkbox: { width: 17, height: 17, accentColor: "#007BC9", cursor: "pointer", flexShrink: 0 },
  checkboxLabel: { fontSize: 13.5, fontWeight: 500, color: "#1C2733" },
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
  rosterRow: { display: "flex", alignItems: "center", gap: 8, fontSize: 13, padding: "8px 10px", background: "#F8F9FB", borderRadius: 6, flexWrap: "wrap" },
  assignRowName: { flex: "1 1 160px", minWidth: 120 },
  assignSelect: { fontSize: 12.5, padding: "6px 8px", flex: "1 1 140px", minWidth: 130 },
  chip: { display: "flex", alignItems: "center", gap: 6, background: "#EFF3F8", color: "#1C2733", padding: "5px 6px 5px 12px", borderRadius: 20, fontSize: 12.5 },
  chipX: { border: "none", background: "#E2E6ED", borderRadius: "50%", width: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#5A6478" },
};
