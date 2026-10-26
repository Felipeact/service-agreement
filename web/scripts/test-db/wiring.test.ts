import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const webRoot = path.join(__dirname, "..", "..");
const repoRoot = path.join(webRoot, "..");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === "node_modules" || entry.name.startsWith(".next")) return [];
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return entry.isFile() ? [full] : [];
  });
}

describe("test:db wiring", () => {
  test("C214: script, exact dev dependency, example env line, no public variant", () => {
    const pkg = JSON.parse(readFileSync(path.join(webRoot, "package.json"), "utf8"));
    expect(pkg.scripts["test:db"]).toBeTypeOf("string");
    expect(pkg.devDependencies.pg).toMatch(/^\d+\.\d+\.\d+$/);
    expect(pkg.dependencies.pg).toBeUndefined();

    const example = readFileSync(path.join(webRoot, ".env.example"), "utf8").split(/\r?\n/);
    expect(example).toContain("SUPABASE_DB_URL=");

    const publicName = ["NEXT_PUBLIC", "SUPABASE_DB_URL"].join("_");
    const offenders = sourceFiles(webRoot).filter((file) => readFileSync(file, "utf8").includes(publicName));
    expect(offenders).toEqual([]);
  });

  test("C218: CONTEXT.md records the accepted advisor findings and how to run the tests", () => {
    const context = readFileSync(path.join(repoRoot, "CONTEXT.md"), "utf8");
    const outbox = context.split(/\r?\n/).find((line) => line.includes("rls_enabled_no_policy"));
    const password = context.split(/\r?\n/).find((line) => line.includes("auth_leaked_password_protection"));
    expect(outbox).toMatch(/AD-016/);
    expect(password).toMatch(/magic link/i);

    const section = context.split(/^## /m).find((part) => part.startsWith("How to run the tests"));
    expect(section).toBeDefined();
    expect(section).toContain("npm test");
    expect(section).toContain("npm run test:db");
    expect(section).toMatch(/Playwright MCP/);
    for (const width of ["375", "768", "1440"]) expect(section).toContain(width);
    expect(section).toMatch(/touch/);
    expect(section).toMatch(/console/);
  });
});
