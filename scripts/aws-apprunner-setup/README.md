# AWS App Runner CLI setup (PowerShell, `eu-west-1`)

Run commands from this folder so `file://` paths resolve.

## Results (this run)

| Item | Value |
|------|--------|
| **IAM role ARN** | `arn:aws:iam::279127167519:role/nrcs-eam-apprunner-role` |
| **App Runner service ARN** | `arn:aws:apprunner:eu-west-1:279127167519:service/nrcs-eam-api/62007c1a6a9c4312bec0c1b342312be1` |
| **Service URL** | `https://vy3xagmuzx.eu-west-1.awsapprunner.com` |
| **Deployment status** | **`RUNNING`** (smoke test: `GET /health` → `200` and `{"ok":true}`). |

## Private RDS + VPC egress (required for this account)

`nrcs-mysql` is **not publicly accessible**. App Runner **default** internet egress cannot reach it (`ETIMEDOUT` on `SELECT 1`). Use a **VPC connector** in the same VPC/subnets as RDS, and allow the connector’s security group on RDS **3306**.

Connector ENIs usually **do not** get public IPs, so **HTTPS to the public Secrets Manager API** can also fail from those subnets. Add an **interface VPC endpoint** for **`com.amazonaws.eu-west-1.secretsmanager`** (private DNS enabled) and a security group on the endpoint that allows **inbound TCP 443** from the App Runner connector security group.

Resources used in `eu-west-1` (names are stable; IDs are for reference):

| Resource | ID / ARN |
|----------|-----------|
| VPC | `vpc-058d4b631fce95dee` |
| App Runner VPC connector | `arn:aws:apprunner:eu-west-1:279127167519:vpcconnector/nrcs-eam-rds/1/29d33cf34990434e9529c61a0959e7b7` |
| Connector security group | `sg-04f40d6377a01d46e` (`nrcs-eam-apprunner-connector`) |
| RDS security group ingress | `sg-0913904f37a2e77fe` allows **3306** from `sg-04f40d6377a01d46e` |
| Secrets Manager interface endpoint | `vpce-04b949c04c6ff6fab` |
| Endpoint security group | `sg-0b41f6e44bff762be` (`nrcs-eam-vpce-endpoints`) allows **443** from `sg-04f40d6377a01d46e` |

`apprunner-update-service.json` includes **`NetworkConfiguration`** so updates keep **VPC** egress.

## Important: GitHub connection vs access role

For a **GitHub** source with a **Connection**, AWS returns:

`Both AccessRoleArn and ConnectionArn cannot be provided`

Use **`ConnectionArn` only** (no `AccessRoleArn`). The access role with `build.apprunner.amazonaws.com` is used for **ECR** and some other sources; GitHub OAuth uses the connection.

## Trust policy (this repo’s `trust-policy.json`)

Includes **both**:

- `build.apprunner.amazonaws.com` — if you later use this role as an **ECR access** role  
- `tasks.apprunner.amazonaws.com` — **required** for **`InstanceRoleArn`** (runtime `GetSecretValue` from Secrets Manager)

## Step 1 — Create IAM role

```powershell
Set-Location c:\Antigravity\Projects\nrcs-eam\scripts\aws-apprunner-setup

aws iam create-role `
  --role-name nrcs-eam-apprunner-role `
  --assume-role-policy-document file://trust-policy.json
```

## Step 2 — Attach Secrets Manager policy

```powershell
aws iam put-role-policy `
  --role-name nrcs-eam-apprunner-role `
  --policy-name SecretsAccess `
  --policy-document file://secrets-policy.json
```

## Step 3 — Get role ARN

```powershell
aws iam get-role --role-name nrcs-eam-apprunner-role
```

## Step 4 — List services

```powershell
aws apprunner list-services --region eu-west-1
```

## Step 5 — Update service

Use `apprunner-update-service.json` (GitHub **connection only**, **instance role**, env vars, HTTP `/health`). Example:

```powershell
aws apprunner update-service --region eu-west-1 --cli-input-json file://apprunner-update-service.json
```

Edit the JSON if your ARNs or connection change.

## Step 6 — Environment variables

Set in the JSON `RuntimeEnvironmentVariables` (or Console). Production wiring used here:

- `NODE_ENV=production`
- `PORT=3000`
- `AWS_REGION=eu-west-1`
- `AWS_SECRETS_SECRET_ID=nrcs-eam/prod/app`
- `FRONTEND_ORIGIN=https://nrcseam.techivano.com`
- `CORS_ORIGINS=https://nrcseam.techivano.com`
- `DATABASE_SSL=true`, `DATABASE_SSL_REJECT_UNAUTHORIZED=true`, `DATABASE_SSL_CA_PATH=./certs/global-bundle.pem`

Database credentials and `JWT_SECRET` should live in **Secrets Manager** JSON merged at startup (`loadSecrets`), not only in plain env.

## Step 7 — Start deployment (only when RUNNING)

```powershell
aws apprunner start-deployment `
  --service-arn "arn:aws:apprunner:eu-west-1:279127167519:service/nrcs-eam-api/62007c1a6a9c4312bec0c1b342312be1" `
  --region eu-west-1
```

## Step 8 — Describe service

```powershell
aws apprunner describe-service `
  --service-arn "arn:aws:apprunner:eu-west-1:279127167519:service/nrcs-eam-api/62007c1a6a9c4312bec0c1b342312be1" `
  --region eu-west-1
```

## If the service stays CREATE_FAILED

1. Open **AWS Console → App Runner → nrcs-eam-api → Logs** and fix the reported **build** or **runtime** error.  
2. Optionally **delete** the service and **create** a new one with the same settings once the failure reason is fixed:

```powershell
aws apprunner delete-service `
  --service-arn "arn:aws:apprunner:eu-west-1:279127167519:service/nrcs-eam-api/62007c1a6a9c4312bec0c1b342312be1" `
  --region eu-west-1
```

(Only after you accept downtime and have a working build command.)

## Troubleshooting: read logs from PowerShell (no Console)

Log group (example):

`/aws/apprunner/nrcs-eam-api/62007c1a6a9c4312bec0c1b342312be1/service`

Recent build lines:

```powershell
aws logs filter-log-events `
  --region eu-west-1 `
  --log-group-name "/aws/apprunner/nrcs-eam-api/62007c1a6a9c4312bec0c1b342312be1/service" `
  --start-time $([DateTimeOffset]::UtcNow.AddHours(-2).ToUnixTimeMilliseconds()) `
  --limit 200
```

Look for `[Build]` lines and any `command not found` / `non-zero code`.

### Observed failure: `pnpm: command not found` (exit 127)

App Runner’s Node build image does not put **`npm install -g pnpm`** on `PATH` in the `RUN` step.

**Fix:** use **Corepack** (Node 22) in `BuildCommand`, as in `apprunner-update-service.json`:

`corepack enable && corepack prepare pnpm@9.15.4 --activate && pnpm install && pnpm run build`

**Alternative** if Corepack is unavailable:

`npx --yes pnpm@9.15.4 install && npx --yes pnpm@9.15.4 run build`

## Secrets hygiene (production)

1. Put **`DATABASE_URL`**, **`JWT_SECRET`**, and other secrets only in **Secrets Manager** JSON for `nrcs-eam/prod/app` (merged by `loadSecrets` at startup).
2. Remove those keys from App Runner **plain** runtime environment variables in the Console or API. The live service uses **`RuntimeEnvironmentSecrets`: `{}`** and non-secret wiring only (`AWS_SECRETS_SECRET_ID`, SSL flags, CORS, etc.).
3. **Rotate** any credential that was ever stored in plain env or committed to git. After updating the secret value in Secrets Manager, **redeploy** App Runner (or wait for the next task recycle) so new tasks pick up the value.

```powershell
# Optional: list secret metadata (not values) — confirm name and rotation status
aws secretsmanager describe-secret --region eu-west-1 --secret-id nrcs-eam/prod/app
```

For **managed rotation** or a new password, use the flow appropriate to your secret type (RDS integration vs custom JSON); then ensure `DATABASE_URL` in the JSON matches the new credentials.
