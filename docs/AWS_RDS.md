# AWS RDS MySQL for NRCS EAM

This app uses **Drizzle ORM** with **`mysql2`**. On AWS, run **Amazon RDS for MySQL** (or **Aurora MySQL–compatible** with the same connection pattern) and point **`DATABASE_URL`** at the instance.

## What you will create

1. **VPC networking** — RDS lives in private subnets (recommended for production).
2. **DB subnet group** — subnets in **at least two** Availability Zones (required for “Multi-AZ”).
3. **Security group** — allow **TCP 3306** only from your app (EC2/ECS/Lambda security group, VPN, or office IP)—**not** `0.0.0.0/0` in production.
4. **RDS MySQL instance** — engine **MySQL 8.x**, storage, backups, encryption.

## Console walkthrough (high level)

1. **AWS Console** → **RDS** → **Create database**.
2. **Engine:** MySQL (or Aurora MySQL–compatible if you prefer Aurora’s storage model).
3. **Templates:** Dev/Test vs Production (production: enable Multi-AZ if you need failover).
4. **Settings:** DB identifier, **master username**, **master password** (store in **Secrets Manager** long-term).
5. **Instance class:** start with **db.t4g.small** or **db.t3.medium** for small workloads; scale after metrics.
6. **Storage:** General Purpose SSD (gp3); enable autoscaling if desired.
7. **Connectivity:**
   - **VPC:** same VPC as the application (or peered VPC).
   - **Subnet group:** private subnets across AZs.
   - **Public access:** **No** for production.
   - **VPC security group:** create/select a group that allows **inbound 3306** from the app SG only.
8. **Authentication:** password (default); optional **IAM DB authentication** later for advanced setups.
9. **Encryption:** enable **encryption at rest** (KMS).
10. **Backups:** retention window, backup window; enable **Performance Insights** if useful.
11. Create database and wait until status is **Available**.

Copy the **endpoint** hostname (e.g. `nrcs-eam.xxxxxxxxxxxx.us-east-1.rds.amazonaws.com`).

## Application environment

1. **Create database and user** (run in MySQL client connected as master, or use default master only for dev—**not** recommended for production):

   ```sql
   CREATE DATABASE nrcs_eam CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   CREATE USER 'nrcs_app'@'%' IDENTIFIED BY 'your-strong-password';
   GRANT ALL PRIVILEGES ON nrcs_eam.* TO 'nrcs_app'@'%';
   FLUSH PRIVILEGES;
   ```

   Restrict `'nrcs_app'@'%'` to a subnet or SG-bound pattern if you use more granular network controls.

2. **Connection string** in `.env`:

   ```env
   DATABASE_URL=mysql://nrcs_app:YOUR_PASSWORD@endpoint.region.rds.amazonaws.com:3306/nrcs_eam
   DATABASE_SSL=true
   JWT_SECRET=your-long-random-secret
   ```

   **Special characters in the password** must be **URL-encoded** in `DATABASE_URL` (e.g. `@` → `%40`).

3. **`DATABASE_SSL=true`** turns on TLS for `mysql2` (runtime and **Drizzle Kit** migrations). Use it for RDS in production.

### Phase 2 — Production TLS (RDS CA bundle)

Without a CA file, you can use TLS with **`DATABASE_SSL_REJECT_UNAUTHORIZED=false`** (or omit it) so Node accepts the RDS chain without verifying it—useful for dev.

For **verified** TLS in production:

1. Download the [RDS global CA bundle](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/UsingWithRDS.SSL.html) (e.g. `global-bundle.pem`). See [`certs/README.md`](../certs/README.md).
2. Set:

   ```env
   DATABASE_SSL=true
   DATABASE_SSL_REJECT_UNAUTHORIZED=true
   DATABASE_SSL_CA_PATH=./certs/global-bundle.pem
   ```

   Paths are resolved relative to the process **current working directory** unless absolute.

3. The app and **`pnpm db:push`** both read the same `DATABASE_SSL_CA_PATH` via [`shared/mysqlSsl.ts`](../shared/mysqlSsl.ts).

### AWS Secrets Manager (optional)

At startup, if **`AWS_SECRETS_SECRET_ID`** is set, JSON from Secrets Manager is merged into `process.env` (after `.env`). The compute role must allow `secretsmanager:GetSecretValue` on that secret. See [`shared/loadSecrets.ts`](../shared/loadSecrets.ts).

4. Apply schema:

   ```bash
   pnpm db:push
   ```

5. Run the app:

   ```bash
   pnpm dev
   ```

## Deploying the app on AWS (typical)

- **ECS Fargate** or **EC2** + **Application Load Balancer** in the same VPC as RDS.
- Put the Node process in subnets that have a **route** to RDS (private subnets + NAT for outbound if needed).
- Store secrets in **AWS Secrets Manager** or **SSM Parameter Store**, injected as env vars at runtime.

Optional: **RDS Proxy** in front of RDS if you have many short-lived connections (e.g. many Lambda functions).

## Security checklist (long term)

- [ ] RDS **not** publicly accessible; SG allows **3306** only from app sources.
- [ ] **Encryption at rest** enabled; **TLS** to DB (`DATABASE_SSL=true`).
- [ ] Master password in **Secrets Manager**; app user with **least privilege** (not full `GRANT ALL` if you tighten later).
- [ ] **Automated backups** + tested **restore** procedure.
- [ ] **Minor version** upgrades on a schedule; plan **major** MySQL upgrades.

## Cost reminder

You pay for **instance hours**, **storage**, **backup storage** beyond free retention, **Multi-AZ** (roughly double instance cost pattern), and **data transfer**. Use **Reserved Instances** or **Savings Plans** when instance size is stable.

## Aurora vs RDS MySQL

- **RDS MySQL:** familiar MySQL engine, straightforward for this project.
- **Aurora MySQL–compatible:** different storage/replication model; often used at larger scale. Connection string and Drizzle usage are the same from the app’s perspective; tune instance family separately.

For most NRCS EAM deployments, **RDS MySQL** is enough to start.
