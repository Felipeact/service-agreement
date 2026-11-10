import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { ESLint } from "eslint";
import { describe, expect, test } from "vitest";

const webRoot = path.resolve(__dirname, "..");
const domainRoot = __dirname;

const FORBIDDEN = ["next/link", "react", "@supabase/supabase-js", "@/lib/money", "@/components/ui/button", "@/app/layout"];

async function restrictedImports(relativePath: string, specifier: string) {
  const eslint = new ESLint({ cwd: webRoot });
  const [result] = await eslint.lintText(`import "${specifier}";\n`, {
    filePath: path.join(webRoot, relativePath),
  });
  return result.messages.filter((message) => message.ruleId === "no-restricted-imports");
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts") ? [full] : [];
  });
}

describe("the domain layer stays pure", () => {
  test.each(FORBIDDEN)("C32: importing %s from domain/ is a lint error, and allowed from composition/", async (specifier) => {
    const inDomain = await restrictedImports("domain/x.ts", specifier);
    expect(inDomain).toHaveLength(1);
    expect(inDomain[0].message).toContain(specifier);
    expect(await restrictedImports("composition/x.ts", specifier)).toHaveLength(0);
  });

  test("C33: no domain source reads the clock or randomness", () => {
    const files = sourceFiles(domainRoot);
    expect(files.length).toBeGreaterThanOrEqual(4);
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      for (const forbidden of ["Date.now", "new Date(", "Math.random", "crypto"]) {
        expect(text.includes(forbidden), `${path.relative(webRoot, file)} contains ${forbidden}`).toBe(false);
      }
    }
  });
});

/**
 * Files whose "equipment" strings the plan's AC 6 does not cover or that localise at display. The first group are message
 * tables read through `itemText` where they are shown; the second are known gaps the plan leaves out (reported, not hidden).
 */
const ITEM_COPY_ALLOWED = [
  // message tables, spoken in the org's words by itemText where they are displayed
  "components/imports/state.ts",
  "components/agreements/new-agreement-state.ts",
  // outside the feature: the product's own login copy (roadmap Phase 4.5 item 6) and the settings help that names the example word
  "app/login/page.tsx",
  "components/settings/settings-fields.tsx",
  "components/ui/illustrations.tsx",
];

/** Strings that stay literal because they are a default or a table row, spoken in the org's words where they are shown. */
const ITEM_COPY_LITERALS = [
  "components/agreements/version-compare.tsx: Equipment",
  "components/imports/review-view.tsx: Equipment type",
  "components/shell/nav-items.ts: Sites & equipment",
  "components/agreements/new-agreement-state.ts: Sending the equipment list…",
  "components/agreements/new-agreement-state.ts: Finding the equipment…",
];

function appSources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "node_modules" || entry.name === ".next" ? [] : appSources(full);
    return /\.(ts|tsx)$/.test(entry.name) && !/\.(test|testing)\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

/** String literals and JSX text that say "equipment" and are not handed to itemText on the way out. */
function unlocalisedItemCopy(source: string, relative: string): string[] {
  const code = source
    .replace(/\/\*[\s\S]*?\*\//g, (m) => " ".repeat(m.length))
    .replace(/(^|[^:])\/\/.*$/gm, (m, lead) => lead + " ".repeat(m.length - lead.length))
    .replace(/\$\{[^}]*\}/g, (m) => " ".repeat(m.length));
  const found: string[] = [];
  const literal = /(["'`])(?:(?!\1)[^\\\n<>{}]|\\.)*?equipment(?:(?!\1)[^\\\n<>{}]|\\.)*?\1/gi;
  for (const match of code.matchAll(literal)) {
    const before = code.slice(Math.max(0, match.index - 40), match.index);
    if (/itemText\(\s*$/.test(before)) continue;
    const inner = match[0].slice(1, -1);
    // "equipment" alone is a field name; the listed strings are defaults or table rows spoken in the org's words where shown.
    if (inner === "equipment" || ITEM_COPY_LITERALS.includes(`${relative}: ${inner}`)) continue;
    found.push(match[0]);
  }
  for (const match of code.replace(/\{[^{}]*\}/g, (m) => " ".repeat(m.length)).matchAll(/>([^<>{}=]*equipment[^<>{}=]*)</gi)) found.push(match[1]);
  return found;
}

describe("item copy goes through the org's words", () => {
  test("C2021: no string or JSX text under components/ and app/ names equipment outside itemText or the named allowlist", () => {
    const roots = ["components", "app"].map((name) => path.join(webRoot, name));
    const offenders: string[] = [];
    for (const root of roots) {
      for (const file of appSources(root)) {
        const relative = path.relative(webRoot, file).split(path.sep).join("/");
        if (ITEM_COPY_ALLOWED.includes(relative)) continue;
        for (const copy of unlocalisedItemCopy(readFileSync(file, "utf8"), relative)) offenders.push(`${relative}: ${copy}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
