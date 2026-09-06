export const NRCS_THEME_STORAGE_KEY = "nrcs-theme";

/** Persist light when the stored value is missing or the old "system" choice. */
export function migrateNrcsTheme(storage: Pick<Storage, "getItem" | "setItem">): "light" | "dark" {
  let stored: string | null = null;
  try {
    stored = storage.getItem(NRCS_THEME_STORAGE_KEY);
  } catch {
    return "light";
  }
  if (stored === "dark") return "dark";
  if (stored !== "light") {
    try {
      storage.setItem(NRCS_THEME_STORAGE_KEY, "light");
    } catch {
      // private mode
    }
    return "light";
  }
  return "light";
}

export function applyNrcsThemeClass(root: Pick<HTMLElement, "classList">, theme: "light" | "dark"): void {
  if (theme === "dark") {
    root.classList.remove("light");
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
    root.classList.add("light");
  }
}
