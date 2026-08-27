// ============================================================
//  data.js  —  Azure replacement for firebase.js
//  Exports the SAME names firebase.js did, so App.jsx only needs
//  its import line changed from "./firebase" to "./data".
//
//  • Data is stored in Azure Cosmos DB, reached through the
//    Azure Functions API in the /api folder (/api/state, /api/signin).
//  • Login checks a shared team password via /api/login (the real
//    password lives safely in Azure app settings, never in the browser).
//  • "Live" updates are done by polling every few seconds — behaves
//    like Firestore's live updates, just on a short delay.
// ============================================================

const POLL_MS = 8000; // how often to re-check the server for changes

/* ------------------------------------------------------------
   Tiny auth state (shared password model)
   ------------------------------------------------------------ */
const AUTH_KEY = "iauditnow-auth";
const authListeners = new Set();

function currentUser() {
  return localStorage.getItem(AUTH_KEY) === "1"
    ? { email: "I-AuditNow (shared login)" }
    : null;
}

function notifyAuth() {
  const u = currentUser();
  authListeners.forEach((cb) => {
    try { cb(u); } catch (e) { /* ignore */ }
  });
}

// Mimics firebase's `auth` object just enough for App.jsx.
export const auth = {
  get currentUser() { return currentUser(); },
};

// signIn(password) — checks the password via the API.
export async function signIn(password) {
  const res = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  if (!res.ok) {
    // shape the error like firebase so App.jsx's message still works
    const err = new Error("invalid password");
    err.code = "auth/invalid-credential";
    throw err;
  }
  localStorage.setItem(AUTH_KEY, "1");
  notifyAuth();
  return { email: "I-AuditNow (shared login)" };
}

export async function logOut() {
  localStorage.removeItem(AUTH_KEY);
  notifyAuth();
}

// watchAuth(cb) — fires cb(user | null) now and whenever it changes.
export function watchAuth(callback) {
  authListeners.add(callback);
  // report current state on next tick (matches firebase's async feel)
  setTimeout(() => callback(currentUser()), 0);
  // also react if another browser tab logs in/out
  const onStorage = (e) => { if (e.key === AUTH_KEY) notifyAuth(); };
  window.addEventListener("storage", onStorage);
  return () => {
    authListeners.delete(callback);
    window.removeEventListener("storage", onStorage);
  };
}

/* ------------------------------------------------------------
   State — the whole app document
   ------------------------------------------------------------ */
const EMPTY_STATE = { audits: [], auditors: [], pos: [] };

async function fetchState() {
  const res = await fetch("/api/state");
  if (!res.ok) throw new Error("failed to load state");
  return res.json();
}

// watchState(cb) — loads once, then polls for changes.
export function watchState(callback) {
  let stopped = false;
  let lastJson = null;

  const tick = async () => {
    if (stopped) return;
    try {
      const state = await fetchState();
      const asJson = JSON.stringify(state);
      if (asJson !== lastJson) {
        lastJson = asJson;
        callback({ ...EMPTY_STATE, ...state });
      }
    } catch (e) {
      console.error("watchState poll failed:", e);
    } finally {
      if (!stopped) setTimeout(tick, POLL_MS);
    }
  };

  tick(); // run immediately
  return () => { stopped = true; };
}

// saveState(next) — writes the whole state back to the server.
export async function saveState(next) {
  const res = await fetch("/api/state", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(next),
  });
  if (!res.ok) throw new Error("failed to save state");
  return res.json();
}

/* ------------------------------------------------------------
   Sign-in log
   ------------------------------------------------------------ */
export async function logSignIn(name) {
  try {
    await fetch("/api/signin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
  } catch (e) {
    console.error("logSignIn failed:", e);
  }
}

// watchSignInLog(cb) — polls the last 100 entries, newest first.
export function watchSignInLog(callback) {
  let stopped = false;
  const tick = async () => {
    if (stopped) return;
    try {
      const res = await fetch("/api/signin");
      if (res.ok) {
        const entries = await res.json();
        callback(entries);
      }
    } catch (e) {
      console.error("watchSignInLog poll failed:", e);
    } finally {
      if (!stopped) setTimeout(tick, POLL_MS * 2);
    }
  };
  tick();
  return () => { stopped = true; };
}
