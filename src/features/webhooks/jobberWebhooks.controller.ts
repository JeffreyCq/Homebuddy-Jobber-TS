// src/features/webhooks/jobberWebhooks.controller.ts
import type { Request, Response } from "express";
import { verifyJobberWebhook } from "../../core/webhookAuth.js";
import { AccountsRepo } from "../../repositories/accounts.repo.js";

export const jobberWebhookHandler = (repo: AccountsRepo) => async (req: Request, res: Response) => {
  const raw = (req as any).rawBody || (req as any).body;
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

  // Responder rápido
  res.sendStatus(200);

  const topic = payload?.data?.webHookEvent?.topic;
  const accountId = payload?.data?.webHookEvent?.accountId;
  const data = payload?.data?.webHookEvent?.data;

  // Procesar async
  try {
    switch (topic) {
      case "APP_DISCONNECT":
        if (accountId) await repo.delete(accountId);
        break;

      // ✅ Nuevo: request status change
      case "REQUEST_STATUS_CHANGED":
        // Aquí podrías notificar a HomeBuddy, guardar métricas, etc.
        // data puede incluir id/status; guarda o loguea según tu necesidad.
        console.log("[Webhook] REQUEST_STATUS_CHANGED", { accountId, data });
        break;

      default:
        // otros tópicos si los habilitas:
        // CLIENT_CREATE, REQUEST_CREATE, etc.
        break;
    }
  } catch (e) {
    // swallow/log
  }
};
