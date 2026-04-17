import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

async function main() {
  const email = process.env.DEBUG_SUPABASE_EMAIL?.trim();
  const password = process.env.DEBUG_SUPABASE_PASSWORD;
  const url = process.env.SUPABASE_URL?.trim() ?? "";
  const anon = process.env.SUPABASE_ANON_KEY ?? "";

  if (!email || !password) {
    throw new Error(
      "Set DEBUG_SUPABASE_EMAIL and DEBUG_SUPABASE_PASSWORD before running"
    );
  }
  if (!url || !anon) {
    throw new Error("SUPABASE_URL and SUPABASE_ANON_KEY are required");
  }

  console.log(
    JSON.stringify({
      supabaseUrlPrefix: url.slice(0, 30),
      looksLikeDbUrl: /^postgres(ql)?:\/\//i.test(url),
      anonKeyPrefix: anon.slice(0, 12),
    })
  );

  const supabase = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    console.error("SIGNIN_ERROR", {
      message: error.message,
      status: (error as { status?: number }).status,
      name: (error as { name?: string }).name,
    });
    process.exit(1);
  }

  console.log("SIGNIN_OK", {
    userId: data.user?.id,
    email: data.user?.email,
    hasSession: Boolean(data.session),
  });
}

main().catch((e) => {
  console.error("SIGNIN_CHECK_FAILED", e);
  process.exit(1);
});
