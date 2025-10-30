import { Router } from "express";
import { oauthCallback } from "../features/auth/oauth.controller.js";
import { inboundLead } from "../features/leads/inbound.controller.js";
import { jobberWebhookHandler } from "../features/webhooks/jobberWebhooks.controller.js";
import { InMemoryAccountsRepo } from "../repositories/accounts.repo.js";

const repo = InMemoryAccountsRepo();
const r = Router();

r.get("/oauth/callback", oauthCallback(repo));
r.post("/jobber/inbound/:accountId/:inboundKey?", inboundLead(repo));
r.post("/webhooks/jobber", jobberWebhookHandler(repo));

export default r;