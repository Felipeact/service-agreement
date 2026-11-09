import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const WEB = path.join(__dirname, "..", "..");
const SELF = path.join(__dirname, "billing-boundaries.test.ts");

/** Every source file under `web/`, with `node_modules`, build output and this file left out. */
function sources(dir = WEB): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return ["node_modules", ".next", ".turbo", "coverage"].includes(entry.name) ? [] : sources(full);
    return /\.(ts|tsx|mts|mjs|cjs|js)$/.test(entry.name) && full !== SELF ? [full] : [];
  });
}

const read = (file: string) => readFileSync(file, "utf8");
const rel = (file: string) => path.relative(WEB, file).split(path.sep).join("/");
const isTest = (file: string) => /\.test\.(ts|tsx|mts)$/.test(file);

describe("where the Stripe secrets live", () => {
  test("C2510: STRIPE_SECRET_KEY is read only in composition, no NEXT_PUBLIC_STRIPE name exists, and the adapter reads no process.env", () => {
    const files = sources();
    const outside = files.filter((file) => !isTest(file) && !rel(file).startsWith("composition/") && read(file).includes("STRIPE_SECRET_KEY"));
    expect(outside.map(rel)).toEqual([]);
    expect(files.filter((file) => read(file).includes("NEXT_PUBLIC_STRIPE")).map(rel)).toEqual([]);
    const adapter = files.filter((file) => rel(file).startsWith("infrastructure/stripe/") && !isTest(file));
    expect(adapter.length).toBeGreaterThan(0);
    expect(adapter.filter((file) => read(file).includes("process.env")).map(rel)).toEqual([]);
  });

  test("C2511: there is no stripe dependency and no import of it", () => {
    const manifest = JSON.parse(read(path.join(WEB, "package.json"))) as { dependencies?: object; devDependencies?: object };
    expect(Object.keys({ ...manifest.dependencies, ...manifest.devDependencies }).filter((name) => /^(stripe|@stripe\/)/.test(name))).toEqual([]);
    const importing = sources().filter((file) => /from\s+["'](stripe|@stripe\/[^"']*)["']|require\(["']stripe["']\)/.test(read(file)));
    expect(importing.map(rel)).toEqual([]);
  });

  test("C2529: .env.example documents the key, the base url and the Vault secret, and STRIPE_WEBHOOK_SECRET exists nowhere", () => {
    const example = read(path.join(WEB, ".env.example"));
    expect(example).toMatch(/^STRIPE_SECRET_KEY=/m);
    expect(example).toContain("Stripe dashboard > Developers > API keys");
    expect(example).toContain("APP_BASE_URL");
    expect(example).toContain("required for Checkout");
    expect(example).toContain("stripe_webhook_secret");
    expect(example).not.toContain("STRIPE_WEBHOOK_SECRET");
    expect(sources().filter((file) => read(file).includes("STRIPE_WEBHOOK_SECRET")).map(rel)).toEqual([]);
  });
});
