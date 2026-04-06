# AWS App Runner CLI setup (PowerShell, `eu-west-1`)

Run commands from this folder so `file://` paths resolve.

## Results (this run)

| Item | Value |
|------|--------|
| **IAM role ARN** | `arn:aws:iam::279127167519:role/nrcs-eam-apprunner-role` |
| **App Runner service ARN** | `arn:aws:apprunner:eu-west-1:279127167519:service/nrcs-eam-api/62007c1a6a9c4312bec0c1b342312be1` |
| **Service URL** | `https://vy3xagmuzx.eu-west-1.awsapprunner.com` |
| **Deployment status** | Service remained in **`CREATE_FAILED`** after updates; check **App Runner → nrcs-eam-api → Logs** (build / deploy) for the error. `start-deployment` only works when status is **RUNNING**. |

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
