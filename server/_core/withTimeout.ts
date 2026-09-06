/** Race work against a deadline; logs timeout label for Vercel diagnostics. */

export async function withTimeout<T>(
  work: Promise<T> | (() => Promise<T>),
  ms: number,
  label: string
): Promise<T> {
  const promise = typeof work === "function" ? work() : work;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`timeout:${label}`)), ms);
      }),
    ]);
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("timeout:")) {
      console.warn(JSON.stringify({ event: "query_timeout", label, ms }));
    }
    throw err;
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
