import { describe, expect, it } from "vitest";
import { applyNrcsThemeClass, migrateNrcsTheme } from "./nrcsTheme";

function memoryStorage(initial: Record<string, string> = {}): Storage {
  const data = { ...initial };
  return {
    get length() {
      return Object.keys(data).length;
    },
    clear() {
      for (const key of Object.keys(data)) delete data[key];
    },
    getItem(key: string) {
      return key in data ? data[key]! : null;
    },
    key(index: number) {
      return Object.keys(data)[index] ?? null;
    },
    removeItem(key: string) {
      delete data[key];
    },
    setItem(key: string, value: string) {
      data[key] = value;
    },
  };
}

describe("migrateNrcsTheme", () => {
  it("writes light when the stored theme is system", () => {
    const storage = memoryStorage({ "nrcs-theme": "system" });
    expect(migrateNrcsTheme(storage)).toBe("light");
    expect(storage.getItem("nrcs-theme")).toBe("light");
  });

  it("writes light when the key is absent", () => {
    const storage = memoryStorage();
    expect(migrateNrcsTheme(storage)).toBe("light");
    expect(storage.getItem("nrcs-theme")).toBe("light");
  });

  it("keeps an explicit dark preference", () => {
    const storage = memoryStorage({ "nrcs-theme": "dark" });
    expect(migrateNrcsTheme(storage)).toBe("dark");
    expect(storage.getItem("nrcs-theme")).toBe("dark");
  });

  it("resolves a persisted system profile to light after one load", () => {
    const storage = memoryStorage({ "nrcs-theme": "system" });
    const added: string[] = [];
    const removed: string[] = [];
    applyNrcsThemeClass(
      {
        classList: {
          add: (name: string) => added.push(name),
          remove: (name: string) => removed.push(name),
        },
      } as unknown as HTMLElement,
      migrateNrcsTheme(storage)
    );
    expect(storage.getItem("nrcs-theme")).toBe("light");
    expect(removed).toContain("dark");
    expect(added).toContain("light");
  });
});
