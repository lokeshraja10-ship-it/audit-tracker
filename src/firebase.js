import { initializeApp } from "firebase/app";
import {
  getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged,
} from "firebase/auth";
import { getFirestore, doc, onSnapshot, setDoc, collection, addDoc, query, orderBy, limit, serverTimestamp } from "firebase/firestore";

// Fill these in from Firebase Console → Project Settings → Your apps → SDK config.
// These values are safe to commit / expose publicly — Firebase's own docs confirm this;
// real access control lives in Firestore Security Rules (see firestore.rules), not in
// keeping this config secret.
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// One shared login for the whole team — no per-person accounts, no Google popup.
// Everyone types the same password. You create exactly ONE user for this in
// Firebase Console → Authentication → Users → Add user, using this exact email.
const SHARED_LOGIN_EMAIL = "team@bpclaudit.local";

export async function signIn(password) {
  const result = await signInWithEmailAndPassword(auth, SHARED_LOGIN_EMAIL, password);
  return result.user;
}

export function logOut() {
  return signOut(auth);
}

export function watchAuth(callback) {
  return onAuthStateChanged(auth, callback);
}

// The whole app's data lives in one Firestore document, mirroring exactly how the
// prototype's shared storage worked — so every screen behaves identically, just with
// real accounts and real live sync across devices instead of a single shared demo state.
const STATE_DOC = doc(db, "app", "state");

export function watchState(callback) {
  return onSnapshot(STATE_DOC, (snap) => {
    callback(snap.exists() ? snap.data() : { audits: [], auditors: [], pos: [] });
  });
}

export async function saveState(next) {
  await setDoc(STATE_DOC, next);
}

// Sign-in log — a lightweight, append-only trail of who used the app and when.
// Kept as its own collection (not inside the shared state document) so writing a
// log entry never risks overwriting someone else's in-progress data edit.
const LOG_COLLECTION = collection(db, "signInLog");

export async function logSignIn(name) {
  await addDoc(LOG_COLLECTION, { name: name || "(unnamed)", at: serverTimestamp() });
}

export function watchSignInLog(callback) {
  const q = query(LOG_COLLECTION, orderBy("at", "desc"), limit(100));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}
