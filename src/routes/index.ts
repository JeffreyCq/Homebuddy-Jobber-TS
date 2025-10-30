// src/routes/index.ts
import { Router } from "express";
import { oauthCallback } from "../features/auth/oauth.controller.js";
import { inboundLead } from "../features/leads/inbound.controller.js";
import { jobberWebhookHandler } from "../features/webhooks/jobberWebhooks.controller.js";
import { appDisconnect } from "../features/auth/disconnect.controller.js";
import { PgAccountsRepo } from "../repositories/accounts.repo.js";

const repo = PgAccountsRepo(); 
const r = Router();

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

// OAuth callback
r.get("/oauth/callback", oauthCallback(repo));

// Inbound para recibir leads
r.post("/jobber/inbound/:accountId/:inboundKey?", inboundLead(repo));

// Webhooks Jobber
r.post("/webhooks/jobber", jobberWebhookHandler(repo));

// ✅ Disconnect manual (appDisconnect)
r.post("/disconnect/:accountId", appDisconnect(repo));

export default r;
