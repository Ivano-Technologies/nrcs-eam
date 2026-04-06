# Frontend deploy: Vercel (primary) vs S3 + CloudFront (optional)

## Primary: Vercel

Production frontend deploys are expected from **Vercel** (import GitHub repo, env `VITE_API_BASE_URL`, domain `nrcseam.techivano.com`). See [CUSTOM_DOMAINS_VERCEL_AWS.md](CUSTOM_DOMAINS_VERCEL_AWS.md) for **Root Directory**, **Build Command**, and **Output Directory** (`dist/public`).

No GitHub Action is required for the default Vercel flow.

## Optional: GitHub Actions — S3 + CloudFront

Workflow: [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml)

**Status:** **Manual only** — trigger **`workflow_dispatch`** in the Actions tab. It does **not** run on `push` to `main`, so it does not compete with Vercel.

Use this when you want to publish the same Vite build to **S3** and invalidate **CloudFront** (e.g. DR or migration).

**Steps:** checkout → Node 20 + pnpm → `pnpm install --frozen-lockfile` → `pnpm run build:frontend` (with **`VITE_API_BASE_URL`** from secrets) → `aws s3 sync` / `aws s3 cp` → CloudFront invalidation.

## Required secrets (only if you use the S3 workflow)

Configure under **Settings → Secrets and variables → Actions**:

| Secret | Description |
|--------|-------------|
| `AWS_ACCESS_KEY_ID` | IAM user access key for deploy |
| `AWS_SECRET_ACCESS_KEY` | IAM user secret key |
| `S3_FRONTEND_BUCKET` | Bucket name only (e.g. `nrcs-eam-frontend`), no `s3://` prefix |
| `CLOUDFRONT_DISTRIBUTION_ID` | CloudFront distribution ID (e.g. `E1234567890ABC`) |
| `VITE_API_BASE_URL` | API base URL, no trailing slash (e.g. `https://api.nrcseam.techivano.com`). If omitted, the bundle uses same-origin `/api/trpc`. |

Optional: change `AWS_REGION` in the workflow file if you do not use `eu-west-1`.

## IAM policy (least privilege, S3 path only)

Attach a policy like the following to the **IAM user** whose keys you store in GitHub. Replace the bucket name with yours.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "FrontendBucket",
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::nrcs-eam-frontend",
        "arn:aws:s3:::nrcs-eam-frontend/*"
      ]
    },
    {
      "Sid": "CloudFrontInvalidation",
      "Effect": "Allow",
      "Action": "cloudfront:CreateInvalidation",
      "Resource": "*"
    }
  ]
}
```

`CreateInvalidation` does not support resource-level ARNs in all setups; `Resource: "*"` with only this action is a common pattern. Prefer [OIDC + IAM role](https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services) over long-lived access keys when you can.

## RDS security (manual checklist)

Do this in the AWS console for production databases:

1. **Public access:** RDS instance → **Public access = No**.
2. **Security group:** Inbound **3306** (or your DB port) only from the **App Runner VPC connector** security group — remove **`0.0.0.0/0`**.
3. **Networking:** App Runner **VPC connector** in the **same VPC** as RDS; use **private subnets** with routing to RDS.
4. **Recommended:** Enable **deletion protection**, **automated backups**, and **storage autoscaling** on the RDS instance.

See also [AWS_RDS.md](AWS_RDS.md) and [AWS_APP_RUNNER.md](AWS_APP_RUNNER.md).
