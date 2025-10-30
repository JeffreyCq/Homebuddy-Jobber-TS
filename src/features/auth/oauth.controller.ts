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

    // Generate an inboundKey for security (optional)
    const inboundKey = Buffer.from(crypto.randomBytes(16)).toString("hex");

    await repo.save({
      accountId,
      accessToken: access_token,
      refreshToken: refresh_token,
      updatedAt: new Date(),
      // You can extend the repo to persist inboundKey too
    });

    res.send(`
      ✅ HomeBuddy x Jobber connected!<br/>
      Account ID: <b>${accountId}</b><br/>
      Send leads to:<br/>
      <code>${baseUrl}/jobber/inbound/${accountId}/${inboundKey}</code>
    `);
  } catch (e) {
    res.status(500).send("OAuth error");
  }
};