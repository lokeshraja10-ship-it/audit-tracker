// ============================================================
//  /api/login  —  checks the shared team password
//  POST /api/login  { password }  -> { ok: true }  or  401
//  The real password is stored securely as an Azure app setting
//  (APP_PASSWORD) — never in the code or the browser bundle.
// ============================================================
const { app } = require("@azure/functions");

app.http("login", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "login",
  handler: async (request, context) => {
    try {
      const body = await request.json();
      const supplied = body && body.password ? String(body.password) : "";
      const expected = process.env.APP_PASSWORD || "";

      if (expected && supplied === expected) {
        return { jsonBody: { ok: true } };
      }
      return { status: 401, jsonBody: { ok: false, error: "invalid-credential" } };
    } catch (err) {
      context.error("login function failed:", err);
      return { status: 500, jsonBody: { error: String(err) } };
    }
  },
});
