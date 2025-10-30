import { Router } from "express";
import { oauthCallback } from "../features/auth/oauth.controller.js";
import { inboundLead } from "../features/leads/inbound.controller.js";
import { jobberWebhookHandler } from "../features/webhooks/jobberWebhooks.controller.js";
import { appDisconnect } from "../features/auth/disconnect.controller.js";
import { PgAccountsRepo } from "../repositories/accounts.repo.js";
import { Pool } from "pg";

// Inicializa repositorio Postgres
const repo = PgAccountsRepo();
const r = Router();

// ✅ Connect: construye authorize URL y redirige
r.get("/connect", (_req, res) => {
  let baseUrl = process.env.APP_BASE_URL || "";
  if (!baseUrl.startsWith("http")) {
    baseUrl = `https://${baseUrl.replace(/^\/+/, "")}`;
  }

  const authorizeUrl = new URL("https://api.getjobber.com/api/oauth/authorize");
  authorizeUrl.searchParams.set("client_id", process.env.JOBBER_CLIENT_ID!);
  authorizeUrl.searchParams.set("redirect_uri", `${baseUrl}/oauth/callback`);
  authorizeUrl.searchParams.set("response_type", "code");
  res.redirect(authorizeUrl.toString());
});

// ✅ OAuth callback (Jobber → nuestra app)
r.get("/oauth/callback", oauthCallback(repo));

// ✅ Endpoint para recibir leads desde HomeBuddy
r.post("/jobber/inbound/:accountId/:inboundKey?", inboundLead(repo));

// ✅ Webhooks de Jobber (APP_DISCONNECT, etc.)
r.post("/webhooks/jobber", jobberWebhookHandler(repo));

// ✅ Disconnect manual (desde HomeBuddy UI o QA)
r.post("/disconnect/:accountId", appDisconnect(repo));

/* -------------------------------------------------------------------------- */
/*                              🔍 DEBUG ROUTES                               */
/* -------------------------------------------------------------------------- */

// Test de conexión a Postgres
const testPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

r.get("/debug/db", async (_req, res) => {
  try {
    const { rows } = await testPool.query("SELECT NOW() as now");
    res.json({ ok: true, now: rows[0].now });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Verifica si las variables de entorno están cargadas correctamente
r.get("/debug/env", (_req, res) => {
  res.json({
    hasClientId: !!process.env.JOBBER_CLIENT_ID,
    hasClientSecret: !!process.env.JOBBER_CLIENT_SECRET,
    graphqlVersion: process.env.JOBBER_GRAPHQL_VERSION,
    appBaseUrl: process.env.APP_BASE_URL,
    hasDatabaseUrl: !!process.env.DATABASE_URL,
  });
});

/* -------------------------------------------------------------------------- */

export default r;
