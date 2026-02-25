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
/* 🛠️ NIKOLAY'S STATIC PAGES FOR APP REVIEW                                  */
/* -------------------------------------------------------------------------- */

/**
 * Connected Page
 * Expected GET: /connect/:accountId/:connectId/:contactEmail
 */
r.get("/connect/:accountId/:connectId/:contactEmail", (req, res) => {
  const { accountId, connectId, contactEmail } = req.params;
  const accountName = accountId; // Fallback since name isn't in the URL

  res.send(`
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Connected — HomeBuddy × Jobber</title>
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <link rel="stylesheet" href="https://unpkg.com/mvp.css" />
</head>
<body>
  <main>
    <h1>✅ Connected</h1>
    <p>Account: <b>${accountName}</b> (<code>${accountId}</code>)</p>
    <p>Connect ID: <b>${connectId}</b></p>

    <h3>Please reach our Account Manager and provide your Connect ID.</h3>
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
      <code id="url">${contactEmail}</code>
      <button onclick="copy()">Copy email</button>
    </div>

    <form method="post" action="https://api-zeta.stage.sirenltd.dev/v1/external/jobber/disconnect/${accountId}/${connectId}/${contactEmail}" onsubmit="return confirm('Disconnect this app?');">
      <button type="submit" style="background:#c0392b; border-color:#c0392b; color: white;">Disconnect</button>
    </form>
  </main>
  <script>
    function copy(){
      const t = document.getElementById('url').innerText;
      navigator.clipboard.writeText(t).then(()=>alert('Copied!'));
    }
  </script>
</body>
</html>
  `);
});

/**
 * Disconnected Page
 * Expected GET: /disconnect/:accountId
 */
r.get("/disconnect/:accountId", (req, res) => {
  const { accountId } = req.params;
  res.send(`
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Disconnected — HomeBuddy × Jobber</title>
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <link rel="stylesheet" href="https://unpkg.com/mvp.css" />
</head>
<body>
  <main>
    <h1>❌ Disconnected</h1>
    <p>The account <code>${accountId}</code> has been successfully disconnected.</p>
    <p>You may now close this window.</p>
  </main>
</body>
</html>
  `);
});

/* -------------------------------------------------------------------------- */
/* 🔍 DEBUG ROUTES                              */
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

export default r;
