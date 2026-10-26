import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { ESLint } from "eslint";
import { describe, expect, test } from "vitest";

const webRoot = __dirname;

/** Built so this file does not match its own search. */
const SESSION_CALL = ["getSession", "("].join("");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) return [];
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx|mjs|js)$/.test(entry.name) ? [full] : [];
  });
}

async function restrictedImports(relativePath: string, specifier: string) {
  const eslint = new ESLint({ cwd: webRoot });
  const [result] = await eslint.lintText(`import "${specifier}";\n`, {
    filePath: path.join(webRoot, relativePath),
  });
  return result.messages.filter((message) => message.ruleId === "no-restricted-imports");
}

const APPLICATION_FORBIDDEN = [
  "next/headers",
  "react",
  "@supabase/supabase-js",
  "@/lib/money",
  "@/components/ui/button",
  "@/app/layout",
  "@/infrastructure/clock",
  "@/composition",
];

const UI_FORBIDDEN = ["@/infrastructure/clock", "@supabase/ssr"];
const INFRASTRUCTURE_FORBIDDEN = ["react", "@/app/layout", "@/components/ui/button", "@/composition"];

const PARSER_LIBRARY_PLACES = ["application/x.ts", "components/x.tsx", "app/x.tsx", "domain/x.ts", "infrastructure/supabase/x.ts"];

describe("layer boundaries", () => {
  test.each(PARSER_LIBRARY_PLACES.flatMap((file) => ["xlsx", "mammoth"].map((specifier) => [file, specifier])))(
    "C487: %s importing %s is a lint error naming it",
    async (file, specifier) => {
      const messages = await restrictedImports(file, specifier);
      expect(messages).toHaveLength(1);
      expect(messages[0].message).toContain(specifier);
    },
  );

  test.each(["xlsx", "mammoth"])("C487: infrastructure/import-parsers may import %s", async (specifier) => {
    expect(await restrictedImports("infrastructure/import-parsers/x.ts", specifier)).toHaveLength(0);
  });

  test.each(APPLICATION_FORBIDDEN)("C24: importing %s from application/ is a lint error", async (specifier) => {
    const messages = await restrictedImports("application/x.ts", specifier);
    expect(messages).toHaveLength(1);
    expect(messages[0].message).toContain(specifier);
  });

  test("C24: application/ may import the domain", async () => {
    expect(await restrictedImports("application/x.ts", "@/domain/agreement")).toHaveLength(0);
  });

  test.each(
    ["app/x.tsx", "components/x.tsx", "lib/x.ts"].flatMap((file) => UI_FORBIDDEN.map((specifier) => [file, specifier])),
  )("C25: %s importing %s is a lint error", async (file, specifier) => {
    const messages = await restrictedImports(file, specifier);
    expect(messages).toHaveLength(1);
    expect(messages[0].message).toContain(specifier);
  });

  test.each(INFRASTRUCTURE_FORBIDDEN)("C25: importing %s from infrastructure/ is a lint error", async (specifier) => {
    const messages = await restrictedImports("infrastructure/x.ts", specifier);
    expect(messages).toHaveLength(1);
    expect(messages[0].message).toContain(specifier);
  });

  test.each(UI_FORBIDDEN)("C25: composition/ may import %s", async (specifier) => {
    expect(await restrictedImports("composition/x.ts", specifier)).toHaveLength(0);
  });

  test("C28: the Supabase dependencies are pinned exact and .env.example names both variables", () => {
    const pkg = JSON.parse(readFileSync(path.join(webRoot, "package.json"), "utf8"));
    expect(pkg.dependencies["@supabase/supabase-js"]).toBe("2.118.0");
    expect(pkg.dependencies["@supabase/ssr"]).toBe("0.12.7");
    expect(pkg.dependencies["server-only"]).toBe("0.0.1");

    const example = readFileSync(path.join(webRoot, ".env.example"), "utf8");
    expect(example).toMatch(/^NEXT_PUBLIC_SUPABASE_URL=/m);
    expect(example).toMatch(/^NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=/m);
  });

  test("C17: no source file reads identity from getSession", () => {
    const offenders = sourceFiles(webRoot).filter((file) => readFileSync(file, "utf8").includes(SESSION_CALL));
    expect(offenders).toEqual([]);
  });

  test("C24: every email address in supabase/seed.sql is on example.com", () => {
    const seed = readFileSync(path.join(webRoot, "..", "supabase", "seed.sql"), "utf8");
    const emails = seed.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) ?? [];
    expect(emails.length).toBeGreaterThan(0);
    expect(emails.filter((email) => !email.endsWith("@example.com"))).toEqual([]);
  });
  test("C101: no screen or component imports Supabase or an adapter", () => {
    const files = [...sourceFiles(path.join(webRoot, "app", "(app)")), ...sourceFiles(path.join(webRoot, "components"))].filter(
      (file) => !file.endsWith(".test.ts"),
    );
    expect(files.length).toBeGreaterThan(10);
    const offenders = files.filter((file) => /from "(@supabase\/|@\/infrastructure)/.test(readFileSync(file, "utf8")));
    expect(offenders).toEqual([]);
  });
});
