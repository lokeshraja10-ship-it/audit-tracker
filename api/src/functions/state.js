// ============================================================
//  /api/state  —  reads & writes the whole app state (one JSON doc)
//  GET  /api/state   -> returns { audits, auditors, pos }
//  POST /api/state   -> saves the posted state
//  Data lives in Cosmos DB: database "iauditnow", container "state",
//  stored as a single document with id = "app".
// ============================================================
const { app } = require("@azure/functions");
const { CosmosClient } = require("@azure/cosmos");

const client = new CosmosClient(process.env.COSMOS_CONNECTION_STRING);
const container = client.database("iauditnow").container("state");

const STATE_ID = "app";
const EMPTY = { audits: [], auditors: [], pos: [] };

app.http("state", {
  methods: ["GET", "POST"],
  authLevel: "anonymous",
  route: "state",
  handler: async (request, context) => {
    try {
      if (request.method === "GET") {
        try {
          const { resource } = await container.item(STATE_ID, STATE_ID).read();
          if (!resource) return { jsonBody: EMPTY };
          // strip Cosmos housekeeping fields, return just the app data
          const { id, _rid, _self, _etag, _attachments, _ts, ...data } = resource;
          return { jsonBody: { audits: [], auditors: [], pos: [], ...data } };
        } catch (e) {
          if (e.code === 404) return { jsonBody: EMPTY };
          throw e;
        }
      }

      // POST -> save
      const body = await request.json();
      const doc = { id: STATE_ID, ...body };
      await container.items.upsert(doc);
      return { jsonBody: { ok: true } };
    } catch (err) {
      context.error("state function failed:", err);
      return { status: 500, jsonBody: { error: String(err) } };
    }
  },
});
