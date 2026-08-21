# BPCL Audit Tracker — Firebase + GitHub Pages (Shared Team Password)

Same app as the Claude prototype (same dashboard, unit detail drill-down, Auditor
Performance tab with quarter-wise breakdown, PDF download, BPCL colors) — now backed by
a real database, hosted for free on GitHub Pages.

Login is a single shared password for the whole team — no per-person accounts, no Google
account, just one password everyone uses. It's still a real gate: Firestore's security
rules require a valid, signed-in session on every read and write, so this isn't just a
hidden URL — someone who doesn't know the password genuinely cannot read or change data,
even if they find your site.

## 1. Create the Firebase project

1. Go to https://console.firebase.google.com → **Add project**.
2. **Build → Authentication → Get started → Sign-in method** → enable **Email/Password**.
3. **Build → Firestore Database → Create database** → production mode → pick a region
   near India (e.g. `asia-south1`).
4. **Project settings (gear icon) → General → Your apps → Add app → Web (`</>`)**. Copy
   the `firebaseConfig` values it shows you.

## 2. Create the one shared login

1. **Build → Authentication → Users** tab → **Add user**.
2. For **Email**, type exactly: `team@bpclaudit.local`
   (This must match `SHARED_LOGIN_EMAIL` in `src/firebase.js` exactly — don't change one
   without the other.)
3. For **Password**, choose the password your whole team will use. Pick something
   reasonably strong but easy to share verbally/by text — a short phrase works well.
4. Click **Add user**. That's the only account you need to create.
5. To change the password later: come back to this Users tab, find the user, and there's
   a way to reset/change the password from the **⋮** menu next to their row.

## 3. Configure the app

1. Open `src/firebase.js` and paste your six config values into `firebaseConfig`.
2. If you want a different shared email than `team@bpclaudit.local`, change
   `SHARED_LOGIN_EMAIL` here to match what you used in step 2.2 above.

## 4. Publish the security rules

```bash
npm install -g firebase-tools
firebase login
firebase init firestore   # pick your project, keep default file names
firebase deploy --only firestore:rules
```
(Or paste `firestore.rules`'s contents directly into Firebase Console → Firestore
Database → Rules tab → Publish — no command line needed.)

## 5. Add your logo (optional)

Open `src/App.jsx`, find `const LOGO_URL = "";` near the top, and paste in a URL to the
official BPCL logo. Leave blank to keep the brand-colored "BP" placeholder mark.

## 6. Run it locally

```bash
npm install
npm run dev
```
Enter the shared password from step 2.3, add a few audits under Setup, and confirm the
Dashboard and Performance tab update.

## 7. Deploy to GitHub Pages

1. Set `BASE_PATH` in `vite.config.js` to your repo name, e.g. `/audit-tracker/`.
2. Push this folder to a new GitHub repo.
3. `npm install -g gh-pages` then `npm run deploy`.
4. In the repo's **Settings → Pages**, set the source to the `gh-pages` branch.

No "authorized domains" step needed — that's only a Google-sign-in requirement.

## Sharing access

Send your team the website link plus the one shared password — one message, done.
Rotating the password later (e.g. if someone leaves) means updating it once in Firebase
(step 2.5) and re-sharing it with everyone still on the team.

## Honest tradeoff of this approach

A shared password can't tell people apart — everyone looks the same to Firestore's rules,
so you lose per-person accountability at the login level (you can still see who's
assigned to what audit inside the app itself, just not who *logged in* to make a change).
If that matters more than the convenience later, moving to individual logins is a small
change: swap `signIn(password)` back to also take an email, and create one Firebase user
per person instead of one shared one — the rest of the app doesn't need to change.

## What changed from the Claude prototype

- `src/firebase.js` replaces the prototype's temporary in-chat storage with real
  Firestore, synced live across everyone signed in.
- The "Who are you?" picker on the Update Audit tab still works the same way (a name you
  pick once, remembered on that device) — it's separate from this shared login, and is
  what the app uses to know whose audits to show.
