// src/core/httpClient.ts
import axios, { AxiosInstance, AxiosHeaders } from "axios";
import { AccountsRepo } from "../repositories/accounts.repo.js";

export function jobberClient(
  repo: AccountsRepo,
  accountId: string,
  getGraphqlVersion: () => string
): AxiosInstance {
  const client = axios.create({
    baseURL: "https://api.getjobber.com/api",
    timeout: 15000,
  });

  client.interceptors.request.use(async (config) => {
    const rec = await repo.get(accountId);
    if (!rec) throw new Error("Account not connected");

    // ✅ Construye headers compatibles con Axios v1
    const headers = AxiosHeaders.from(config.headers || {});
    headers.set("Authorization", `Bearer ${rec.accessToken}`);
    headers.set("X-JOBBER-GRAPHQL-VERSION", getGraphqlVersion());
    headers.set("Content-Type", "application/json");

    config.headers = headers;
    return config;
  });

  client.interceptors.response.use(
    (r) => r,
    async (error) => {
      const status = error?.response?.status;
      if (status === 401) {
        const rec = await repo.get(accountId);
        if (!rec) throw error;

        const form = new URLSearchParams({
          client_id: process.env.JOBBER_CLIENT_ID!,
          client_secret: process.env.JOBBER_CLIENT_SECRET!,
          grant_type: "refresh_token",
          refresh_token: rec.refreshToken,
        });

        const refreshResp = await axios.post(
          "https://api.getjobber.com/api/oauth/token",
          form,
          { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
        );

        const { access_token, refresh_token } = refreshResp.data;
        await repo.update(accountId, {
          accessToken: access_token,
          refreshToken: refresh_token,
        });

        // ✅ Reintenta con headers correctos
        const cfg = error.config;
        const retryHeaders = AxiosHeaders.from(cfg.headers || {});
        retryHeaders.set("Authorization", `Bearer ${access_token}`);
        cfg.headers = retryHeaders;

        return client.request(cfg);
      }
      throw error;
    }
  );

  return client;
}
