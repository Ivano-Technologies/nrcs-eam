let secretsSource: "env" = "env";

/** Where DATABASE_URL / Supabase keys etc. were merged from (after loadSecrets). */
export function getSecretsSource(): "env" {
  return secretsSource;
}

function isLocalPostgresDatabaseUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    if (u.protocol !== "postgresql:" && u.protocol !== "postgres:") return false;
    const h = u.hostname.toLowerCase();
    return h === "localhost" || h === "127.0.0.1" || h === "::1";
  } catch {
    return false;
  }
}

export async function loadSecrets(): Promise<void> {
  secretsSource = "env";
  if (isLocalPostgresDatabaseUrl(process.env.DATABASE_URL)) {
    console.log("[secrets] Using environment variables (local DATABASE_URL host)");
    return;
  }
  console.log("[secrets] Using environment variables (AWS Secrets Manager disabled)");
}
