import type { Request, Response } from "express";
import axios from "axios";
import crypto from "crypto";
import { AccountsRepo } from "../../repositories/accounts.repo.js";

function sendHtmlError(res: Response, tag: string, err: any) {
  const status = err?.response?.status;
  const data = err?.response?.data;
  const msg = err?.message || String(err);
  res
    .status(500)
    .set("Content-Type", "text/html; charset=utf-8")
    .send(`
<!doctype html><html><body>
<h2>OAuth error @ ${tag}</h2>
<pre>${msg}</pre>
<h3>status</h3>
<pre>${status ?? "n/a"}</pre>
<h3>response</h3>
<pre>${data ? JSON.stringify(data, null, 2) : "n/a"}</pre>
</body></html>
`);
}

export const oauthCallback = (repo: AccountsRepo) => async (req: Request, res: Response) => {
  const code = req.query.code as string | undefined;
  if (!code) return res.status(400).send("Missing code");

  let baseUrl =
    (process.env.APP_BASE_URL && process.env.APP_BASE_URL.trim()) ||
    `${req.protocol}://${req.get("host")}`;
  if (!baseUrl.startsWith("http")) baseUrl = `https://${baseUrl}`;

  // 1) TOKEN EXCHANGE
  const form = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: process.env.JOBBER_CLIENT_ID!,
    client_secret: process.env.JOBBER_CLIENT_SECRET!,
    redirect_uri: `${baseUrl}/oauth/callback`,
  });

  let access_token: string;
  let refresh_token: string;

  try {
    const tokenResp = await axios.post("https://api.getjobber.com/api/oauth/token", form, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      timeout: 15000,
    });
    access_token = tokenResp.data.access_token;
    refresh_token = tokenResp.data.refresh_token;
  } catch (e) {
    return sendHtmlError(res, "token_exchange_failed", e);
  }

  // 2) GRAPHQL ACCOUNT
  let accountId: string;
  let accountName: string | undefined;
  try {
    const accountResp = await axios.post(
      "https://api.getjobber.com/api/graphql",
      { query: "{ account { id name } }" },
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
          "X-JOBBER-GRAPHQL-VERSION": process.env.JOBBER_GRAPHQL_VERSION!,
          "Content-Type": "application/json",
        },
        timeout: 15000,
      }
    );

    if (accountResp.data?.errors?.length) {
      throw new Error("GraphQL top-level errors: " + JSON.stringify(accountResp.data.errors));
    }
    accountId = accountResp.data?.data?.account?.id;
    accountName = accountResp.data?.data?.account?.name;
    if (!accountId) throw new Error("account.id missing in GraphQL response");
  } catch (e) {
    return sendHtmlError(res, "account_query_failed", e);
  }

  // 3) SAVE TO DB
  const inboundKey = crypto.randomBytes(16).toString("hex");
  try {
    await repo.save({
      accountId,
      accessToken: access_token!,
      refreshToken: refresh_token!,
      inboundKey,
      updatedAt: new Date(),
    });
  } catch (e) {
    return sendHtmlError(res, "db_save_failed", e);
  }

  // ✅ SUCCESS PAGE
  const inboundUrl = `${baseUrl}/jobber/inbound/${accountId}/${inboundKey}`;
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
    <p>Account: <b>${accountName ?? ""}</b> (<code>${accountId}</code>)</p>

    <h3>Inbound URL</h3>
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
      <code id="url">${inboundUrl}</code>
      <button onclick="copy()">Copy URL</button>
    </div>

    <details>
      <summary>Test with curl</summary>
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
  }'
</pre>
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
};
