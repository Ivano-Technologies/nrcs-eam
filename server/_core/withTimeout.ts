/** Race a promise against a deadline; logs timeout label for Vercel diagnostics. */
export async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`timeout:${label}`)), ms);
      }),
    ]);
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("timeout:")) {
      console.warn(JSON.stringify({ event: "query_timeout", label, ms }));
    }
    throw err;
  }
}
