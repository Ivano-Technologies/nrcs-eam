import postgres from "postgres";

export default async function handler(_req: any, res: any) {
  const url = process.env.DATABASE_URL;
  if (!url) {
    res.status(200).json({ ok: false, error: "DATABASE_URL is not set" });
    return;
  }

  const client = postgres(url, {
    prepare: false,
    max: 1,
    ssl: { rejectUnauthorized: false },
  });

  try {
    const result = await client`
      SELECT
        current_database() as db,
        current_schema() as schema,
        to_regclass('public.users') as users_table_exists,
        COUNT(*) as user_count
      FROM users
    `;
    res.status(200).json({ ok: true, result });
  } catch (e: any) {
    res.status(200).json({ ok: false, error: e?.message, code: e?.code });
  } finally {
    await client.end({ timeout: 5 });
  }
}
