# HomeBuddy ↔ Jobber Integration (TypeScript)

A minimal, production-ready skeleton to connect a Jobber account via OAuth, expose a secure inbound URL to receive leads, and create Client + Request (+ optional Note) in Jobber. Includes:
- OAuth callback that stores `accessToken` and `refreshToken`
- Axios client with automatic **refresh-token rotation**
- Webhook endpoint for **APP_DISCONNECT** (HMAC verified; responds in < 1s)
- Inbound endpoint to **receive leads** and create entities in Jobber
- Clean TS layering (routes → controllers → core/repo)

> This project is designed to be deployed behind your existing Rails infra if you like (reverse proxy), or standalone.

## Quick Start

```bash
# 1) Install
npm i

# 2) Copy env
cp .env.example .env
# Fill JOBBER_CLIENT_ID/SECRET, APP_BASE_URL, JOBBER_GRAPHQL_VERSION

# 3) Dev mode
npm run dev

# 4) Build + start
npm run build && npm start
```

## Important Endpoints

- `GET /oauth/callback` — Jobber redirects here. Stores tokens and returns the per-account inbound URL.
- `POST /jobber/inbound/:accountId/:inboundKey?` — Your partners post leads here. Creates Client + Request in Jobber.
- `POST /webhooks/jobber` — Receives Jobber webhooks (e.g., `APP_DISCONNECT`), HMAC-verified.

## Notes

- **GraphQL version**: Keep `JOBBER_GRAPHQL_VERSION` up to date.
- **Token rotation**: The Axios interceptor saves new `refresh_token` every time.
- **Security**: The inbound route supports an optional `inboundKey` per account; you may also enforce `Authorization` or HMAC for payloads.
- **Persistence**: The sample uses in-memory storage. Swap `InMemoryAccountsRepo` for Redis/Postgres in `src/repositories`.
- **Body parsing**: Webhook route uses `body-parser.raw()`; other routes use JSON.