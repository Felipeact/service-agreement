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
