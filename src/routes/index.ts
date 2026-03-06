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
/* 🛠️ NIKOLAY'S STATIC PAGES (Query Params & Simplified Disconnect Link)      */
/* -------------------------------------------------------------------------- */

/**
 * Connected Page
 * GET: /crm/jobber/connected?connect_id=...&account_name=...&contact_email=...
 */
r.get("/crm/jobber/connected", (req, res) => {
  const connectId = (req.query.connect_id as string) || "";
  const accountName = (req.query.account_name as string) || "";
  const contactEmail = (req.query.contact_email as string) || "";

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
    <p>Account: <b>${accountName}</b></p>
    <p>Connect ID: <b>${connectId}</b></p>

    <h3>Please reach our Account Manager and provide your Connect ID.</h3>
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
      <code id="url">${contactEmail}</code>
      <button onclick="copy()">Copy email</button>
    </div>

    <form method="post" action="https://api-zeta.stage.sirenltd.dev/v1/external/jobber/disconnect/${connectId}" onsubmit="return confirm('Disconnect this app?');">
      <button type="submit" style="background:#c0392b; border-color:#c0392b; color: white; cursor: pointer;">Disconnect</button>
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
 * GET: /crm/jobber/disconnected?connect_id=...&account_name=...
 */
r.get("/crm/jobber/disconnected", (req, res) => {
  const accountName = (req.query.account_name as string) || "Account";

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
    <p>The account <b>${accountName}</b> has been successfully disconnected.</p>
    <p>You may now close this window.</p>
  </main>
</body>
</html>
  `);
});

/* -------------------------------------------------------------------------- */
/* 🔍 DEBUG ROUTES                                                            */
/* -------------------------------------------------------------------------- */

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
