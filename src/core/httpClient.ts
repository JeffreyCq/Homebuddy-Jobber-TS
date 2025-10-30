import axios, { AxiosInstance } from "axios";
import { AccountsRepo } from "../repositories/accounts.repo.js";

export function jobberClient(repo: AccountsRepo, accountId: string, getGraphqlVersion: () => string): AxiosInstance {
  const client = axios.create({
    baseURL: "https://api.getjobber.com/api",
    timeout: 15000
  });

  client.interceptors.request.use(async (config) => {
    const rec = await repo.get(accountId);
    if (!rec) throw new Error("Account not connected");
    config.headers = {
      ...(config.headers || {}),
      Authorization: `Bearer ${rec.accessToken}`,
      "X-JOBBER-GRAPHQL-VERSION": getGraphqlVersion(),
      "Content-Type": "application/json"
    };
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
        await repo.update(accountId, { accessToken: access_token, refreshToken: refresh_token });

        const cfg = error.config;
        cfg.headers.Authorization = `Bearer ${access_token}`;
        return client.request(cfg);
      }
      throw error;
    }
  );

  return client;
}