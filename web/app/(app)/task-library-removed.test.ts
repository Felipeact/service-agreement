import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const WEB = path.join(__dirname, "..", "..");
const SELF = path.join(__dirname, "task-library-removed.test.ts");

function sources(dir = WEB): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return ["node_modules", ".next", ".turbo", "coverage"].includes(entry.name) ? [] : sources(full);
    return /\.(ts|tsx|mts)$/.test(entry.name) && full !== SELF ? [full] : [];
  });
}

describe("the task library screen is gone (the owner's decision, 2026-11-10)", () => {
  test("C3000: there is no /task-library route or task-library components folder", () => {
    expect(existsSync(path.join(WEB, "app", "(app)", "task-library"))).toBe(false);
    expect(existsSync(path.join(WEB, "components", "task-library"))).toBe(false);
  });

  test("C3001: nothing in the app links to /task-library or says the screen exists", () => {
    // User-facing source only: tests state the absence, and the store's server log lines may still name the data.
    const screens = sources().filter((file) => /^(app|components)[\\/]/.test(path.relative(WEB, file)) && !/\.test\.ts$/.test(file));
    const linking = screens.filter((file) => {
      const text = readFileSync(file, "utf8");
      return /["'`]\/task-library/.test(text) || /task library/i.test(text);
    });
    expect(linking.map((file) => path.relative(WEB, file))).toEqual([]);
  });

  test("C3002: the catalog data stays readable: the container still exposes the reader the agreement builder and imports use", () => {
    const container = readFileSync(path.join(WEB, "composition", "index.ts"), "utf8");
    expect(container).toContain("listAssetTypes");
    expect(container).toContain("listTaskLibrary");
  });
});
