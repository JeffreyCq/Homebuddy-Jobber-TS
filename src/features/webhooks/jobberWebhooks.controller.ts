import type { Request, Response } from "express";
import { verifyJobberWebhook } from "../../core/webhookAuth.js";
import { AccountsRepo } from "../../repositories/accounts.repo.js";

export const jobberWebhookHandler = (repo: AccountsRepo) => async (req: Request, res: Response) => {
  const raw = (req as any).rawBody || (req as any).body; // body-parser.raw puts the buffer in req.body
  const rawString = Buffer.isBuffer(raw) ? raw.toString("utf8") : (typeof raw === "string" ? raw : "");
  const sig = req.header("X-Jobber-Hmac-SHA256");

  if (!verifyJobberWebhook(rawString, sig)) return res.sendStatus(401);

  // Parse JSON after signature verification
  let payload: any = {};
  try {
    payload = JSON.parse(rawString);
  } catch {
    return res.sendStatus(400);
  }

  // Respond immediately (<=1s)
  res.sendStatus(200);

  const topic = payload?.data?.webHookEvent?.topic;
  const accountId = payload?.data?.webHookEvent?.accountId;

  // Process async (fire-and-forget)
  if (topic === "APP_DISCONNECT" && accountId) {
    try {
      await repo.delete(accountId);
      // TODO: log / metrics / notify
    } catch (e) {
      // swallow
    }
  }
};