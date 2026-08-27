// ============================================================
//  /api/signin  —  the sign-in / "who identified themselves" log
//  GET  /api/signin  -> returns last 100 entries [{id, name, at}]
//  POST /api/signin  -> adds one entry { name }
//  Data lives in Cosmos DB: database "iauditnow", container "signInLog".
// ============================================================
const { app } = require("@azure/functions");
const { CosmosClient } = require("@azure/cosmos");

const client = new CosmosClient(process.env.COSMOS_CONNECTION_STRING);
const container = client.database("iauditnow").container("signInLog");

function newId() {
  return Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
}

app.http("signin", {
  methods: ["GET", "POST"],
  authLevel: "anonymous",
  route: "signin",
  handler: async (request, context) => {
    try {
      if (request.method === "GET") {
        const query = {
          query: "SELECT TOP 100 c.id, c.name, c.at FROM c ORDER BY c.at DESC",
        };
        const { resources } = await container.items.query(query).fetchAll();
        return { jsonBody: resources };
      }

      // POST -> add an entry
      const body = await request.json();
      const entry = {
        id: newId(),
        name: (body && body.name) ? String(body.name) : "(unnamed)",
        at: new Date().toISOString(),
      };
      await container.items.create(entry);
      return { jsonBody: { ok: true } };
    } catch (err) {
      context.error("signin function failed:", err);
      return { status: 500, jsonBody: { error: String(err) } };
    }
  },
});
