// src/features/auth/oauth.controller.ts
import type { Request, Response } from "express";
import axios from "axios";
import crypto from "crypto";
import { AccountsRepo } from "../../repositories/accounts.repo.js";

export const oauthCallback = (repo: AccountsRepo) => async (req: Request, res: Response) => {
  const code = req.query.code as string | undefined;
  if (!code) return res.status(400).send("Missing code");

  const baseUrl =
    (process.env.APP_BASE_URL && process.env.APP_BASE_URL.trim()) ||
    `${req.protocol}://${req.get("host")}`;

  const form = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: process.env.JOBBER_CLIENT_ID!,
    client_secret: process.env.JOBBER_CLIENT_SECRET!,
    redirect_uri: `${baseUrl}/oauth/callback`,
  });

  try {
    const tokenResp = await axios.post("https://api.getjobber.com/api/oauth/token", form, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" }
    });
    const { access_token, refresh_token } = tokenResp.data;

    const accountResp = await axios.post(
      "https://api.getjobber.com/api/graphql",
      { query: "{ account { id name } }" },
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
          "X-JOBBER-GRAPHQL-VERSION": process.env.JOBBER_GRAPHQL_VERSION!,
        },
      }
    );

    const accountId: string = accountResp.data.data.account.id;

    // ✅ Genera inboundKey y guarda todo
    const inboundKey = Buffer.from(crypto.randomBytes(16)).toString("hex");

    await repo.save({
      accountId,
      accessToken: access_token,
      refreshToken: refresh_token,
      inboundKey,
      updatedAt: new Date(),
    });

    const inboundUrl = `${baseUrl}/jobber/inbound/${accountId}/${inboundKey}`;

    // ✅ HTML “Connected” con copiar al portapapeles
    res.setHeader("Content-Type", "text/html; charset=utf-8");
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
    <p>Your Jobber account is now linked.</p>

    <h3>Account ID</h3>
    <code>${accountId}</code>

    <h3>Inbound URL</h3>
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
      <code id="url">${inboundUrl}</code>
      <button onclick="copy()">Copy URL</button>
    </div>

    <details>
      <summary>How to test</summary>
      <pre>curl -X POST "${inboundUrl}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "firstName":"Jane",
    "lastName":"Doe",
    "email":"jane@example.com",
    "phone":"5551238888",
    "city":"Austin",
    "zip":"78701",
    "description":"Window cleaning lead from HomeBuddy"
  }'</pre>
    </details>

    <form method="post" action="/disconnect/${accountId}" onsubmit="return confirm('Disconnect this app?');">
      <button type="submit" style="background:#c0392b">Disconnect</button>
    </form>

    <p><a href="/">Back to Home</a></p>
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
  } catch (e) {
    res.status(500).send("OAuth error");
  }
};
