// src/features/auth/disconnect.controller.ts
import type { Request, Response } from "express";
import { AccountsRepo } from "../../repositories/accounts.repo.js";
import { jobberClient } from "../../core/httpClient.js";

export const appDisconnect = (repo: AccountsRepo) => async (req: Request, res: Response) => {
  const { accountId } = req.params;
  if (!accountId) return res.sendStatus(400);

  const rec = await repo.get(accountId);
  if (!rec) return res.status(404).json({ error: "Account not found" });

  try {
    // Mutación appDisconnect
    const mutation = `mutation { appDisconnect { success } }`;
    const client = jobberClient(repo, accountId, () => process.env.JOBBER_GRAPHQL_VERSION!);
    await client.post("/graphql", { query: mutation });

    // Limpia tokens localmente
    await repo.delete(accountId);

    // Respuesta simple (si lo llamas desde form, que redirija)
    if (req.headers.accept?.includes("text/html")) {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.send(`
        <html><body>
          <main>
            <h1>Disconnected</h1>
            <p>Your Jobber account <code>${accountId}</code> has been disconnected.</p>
            <p><a href="/">Back to Home</a></p>
          </main>
        </body></html>
      `);
    }
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: "appDisconnect failed", details: err.response?.data || err.message });
  }
};
