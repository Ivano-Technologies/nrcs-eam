export type PasswordStrengthLevel = "weak" | "fair" | "good" | "strong";

function countCharTypes(password: string): number {
  let n = 0;
  if (/[A-Z]/.test(password)) n++;
  if (/[a-z]/.test(password)) n++;
  if (/\d/.test(password)) n++;
  if (/[^A-Za-z0-9]/.test(password)) n++;
  return n;
}

/** Weak: under 8 chars. Fair/Good/Strong: 8+ with one/two/three+ character types (upper, lower, digit, symbol). */
export function getPasswordStrength(password: string): {
  level: PasswordStrengthLevel;
  label: string;
} {
  if (password.length < 8) {
    return { level: "weak", label: "Weak" };
  }
  const types = countCharTypes(password);
  if (types <= 1) return { level: "fair", label: "Fair" };
  if (types === 2) return { level: "good", label: "Good" };
  return { level: "strong", label: "Strong" };
}
