# AWS App Runner (backend)

This app is **TypeScript**: production entry is **`dist/index.js`** (from `esbuild`), not `server/_core/index.js`. The client static files live under **`dist/public/`**.

## Local check (same as App Runner)

```bash
pnpm install
pnpm build
pnpm start
```

You should see `Server running on http://localhost:3000/` (or another port if 3000 is busy).

## App Runner build and start commands

| Field | Value |
|--------|--------|
| **Build** | `npm install -g pnpm && pnpm install && pnpm run build` |
| **Start** | `pnpm start` |
| **Port** | `3000` (or set `PORT` in env) |

Do **not** use only `pnpm install` as the build step—you must run **`pnpm run build`** so `dist/index.js` and `dist/public/` exist.

**Runtime:** Node.js **20** or **22** (see `engines` in `package.json`).

## Environment variables

**Recommended:** store sensitive values in **AWS Secrets Manager** as a JSON object, then set only:

| Variable | Notes |
|----------|--------|
| `AWS_SECRETS_SECRET_ID` | e.g. `nrcs-eam/prod/app` |
| `AWS_REGION` | e.g. `eu-west-1` |

The app loads the secret at startup ([`shared/loadSecrets.ts`](../shared/loadSecrets.ts)) and merges keys into `process.env`. The **App Runner instance role** (or access role) must allow **`secretsmanager:GetSecretValue`** on that secret’s ARN.

**Least-privilege IAM (recommended):** scope `GetSecretValue` to this secret only, not `Resource: "*"`:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "secretsmanager:GetSecretValue",
      "Resource": "arn:aws:secretsmanager:eu-west-1:ACCOUNT_ID:secret:nrcs-eam/prod/app-XXXXXX"
    }
  ]
}
```

Replace `ACCOUNT_ID` and the suffix AWS appends to the secret name. Prefer **one secret** for app config to keep the blast radius small.

**After Secrets Manager is working:** avoid duplicating **`DATABASE_URL`** (and other secrets) in the App Runner console. Keep non-secret wiring in env, for example:

| Variable | Notes |
|----------|--------|
| `AWS_REGION` | e.g. `eu-west-1` |
| `AWS_SECRETS_SECRET_ID` | e.g. `nrcs-eam/prod/app` |
| `NODE_ENV` | `production` |
| `CORS_ORIGINS` | **Required** if the SPA is on another origin than the API (split hosting). Exact HTTPS origins, comma-separated, **no trailing slashes** (e.g. `https://nrcseam.techivano.com`). Loaded at process start—redeploy after changing. See [`CUSTOM_DOMAINS_VERCEL_AWS.md`](CUSTOM_DOMAINS_VERCEL_AWS.md). |
| `FRONTEND_ORIGIN` or `VITE_APP_URL` | **Required in production** (validated at startup): public SPA origin for magic-link URLs (`/auth/verify`). Prefer `FRONTEND_ORIGIN` on App Runner. |
| `DATABASE_SSL` | `true` |
| `DATABASE_SSL_REJECT_UNAUTHORIZED` | `true` |
| `DATABASE_SSL_CA_PATH` | e.g. `./certs/global-bundle.pem` |
| `PORT` | If required by App Runner |

Let **`DATABASE_URL`**, **`JWT_SECRET`**, etc. come **only** from the secret JSON.

Alternatively, set variables directly in App Runner (less ideal for secrets):

| Variable | Notes |
|----------|--------|
| `DATABASE_URL` | MySQL URL to RDS |
| `DATABASE_SSL` | `true` for RDS |
| `DATABASE_SSL_REJECT_UNAUTHORIZED` | `true` in production when using RDS CA PEM |
| `DATABASE_SSL_CA_PATH` | e.g. `./certs/global-bundle.pem` — see [AWS_RDS.md](AWS_RDS.md) Phase 2 |
| `JWT_SECRET` | Session signing |
| `PORT` | App Runner may inject; app respects `PORT` |

## Health check

The server exposes **`GET /health`** with `{ "ok": true }`. Configure App Runner’s health check path to **`/health`** when you enable it.

## Startup order

```mermaid
sequenceDiagram
  participant Dotenv
  participant LoadSecrets
  participant Server
  Dotenv->>Dotenv: dotenv/config loads .env
  LoadSecrets->>LoadSecrets: if AWS_SECRETS_SECRET_ID then SM merge
  Server->>Server: startServer listen
```

## VPC connector (required for private RDS)

1. App Runner → **Networking** → enable **VPC access**.
2. Create a **VPC connector** in the **same VPC** as RDS.
3. Use **private subnets** with routes that can reach RDS (and NAT for outbound if needed).
4. Attach a **security group** for the connector.

## RDS security group

On the **RDS** security group, inbound:

- **Type:** MySQL (3306)
- **Source:** the **App Runner VPC connector** security group (not `0.0.0.0/0`).

## After deployment

- Turn **RDS public access** **OFF** if it was on for bootstrap.
- Prefer **Secrets Manager** for DB password and `JWT_SECRET` instead of plain text in App Runner env UI.

## Architecture

```mermaid
flowchart LR
  clients[Clients]
  apprunner[AppRunner]
  rds[(RDS MySQL)]
  clients --> apprunner
  apprunner --> rds
```

Frontend can be hosted separately (e.g. Vercel) calling this API origin, or serve the built SPA from the same process (`dist/public`).

## Go-live checklist

1. **Build:** `npm install -g pnpm && pnpm install && pnpm build` — produces `dist/index.js` and `dist/public/`, and fetches the RDS CA bundle if missing (`scripts/fetch-rds-ca.mjs`).
2. **Start:** `pnpm start` — listens on `PORT` (default `3000`), production binds `0.0.0.0`.
3. **VPC connector:** Same VPC as RDS; use **2+ subnets**; attach the connector security group.
4. **Security groups:** RDS inbound **MySQL (3306)** from the **App Runner connector SG** only — not `0.0.0.0/0`.
5. **IAM:** Instance role with **`secretsmanager:GetSecretValue`** on your app secret ARN (least privilege above).
6. **Secrets JSON:** Includes at least **`DATABASE_URL`**, **`JWT_SECRET`**, plus any other keys the app expects.
7. **TLS env:** `DATABASE_SSL=true`, `DATABASE_SSL_REJECT_UNAUTHORIZED=true`, `DATABASE_SSL_CA_PATH=./certs/global-bundle.pem` (bundle from build or committed).
8. **Logs to expect:** `[startup] Environment: production` → Secrets source → TLS `enabled (strict)` → **`DB connectivity check passed`** (production only) → **`Listening on port … (bound to 0.0.0.0)`**.

**Residual risk:** Build must reach `truststore.pki.rds.amazonaws.com` to download the CA unless **`certs/global-bundle.pem`** is committed or copied into the image.
