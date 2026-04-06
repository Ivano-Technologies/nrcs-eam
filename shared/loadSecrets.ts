import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";

/**
 * Merge JSON key/value pairs from AWS Secrets Manager into `process.env`.
 * Gated: skips unless `AWS_SECRETS_SECRET_ID` is set (local dev uses `.env` only).
 */
export async function loadSecrets(): Promise<void> {
  const secretId = process.env.AWS_SECRETS_SECRET_ID;

  if (!secretId) {
    console.log(
      "[secrets] Skipping AWS Secrets Manager (AWS_SECRETS_SECRET_ID not set)"
    );
    return;
  }

  const client = new SecretsManagerClient({
    region: process.env.AWS_REGION || "eu-west-1",
  });

  const response = await client.send(
    new GetSecretValueCommand({ SecretId: secretId })
  );

  if (!response.SecretString) {
    throw new Error("Secrets Manager returned no SecretString for this secret");
  }

  const secrets = JSON.parse(response.SecretString) as Record<string, string>;

  for (const key of Object.keys(secrets)) {
    const value = secrets[key];
    if (value !== undefined && value !== null) {
      process.env[key] = String(value);
    }
  }

  console.log("[secrets] Loaded from AWS Secrets Manager:", secretId);
}
