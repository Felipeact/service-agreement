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

  test("C2511: there is no stripe server package and no import of it (amended 2026-11-10: the two browser packages are allowed, see C3132)", () => {
    const manifest = JSON.parse(read(path.join(WEB, "package.json"))) as { dependencies?: object; devDependencies?: object };
    expect(Object.keys({ ...manifest.dependencies, ...manifest.devDependencies }).filter((name) => name === "stripe")).toEqual([]);
    const importing = sources().filter((file) => /from\s+["']stripe["']|require\(["']stripe["']\)/.test(read(file)));
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

describe("the in-app billing page's dependency and keys (billing-page door 1)", () => {
  test("C3131: the publishable key is read only in composition, and the secret key still only there", () => {
    const files = sources().filter((file) => !isTest(file));
    expect(files.filter((file) => !rel(file).startsWith("composition/") && read(file).includes("STRIPE_PUBLISHABLE_KEY")).map(rel)).toEqual([]);
    expect(files.filter((file) => !rel(file).startsWith("composition/") && read(file).includes("STRIPE_SECRET_KEY")).map(rel)).toEqual([]);
    expect(files.filter((file) => read(file).includes("NEXT_PUBLIC_STRIPE")).map(rel)).toEqual([]);
    expect(files.some((file) => rel(file).startsWith("composition/") && read(file).includes("STRIPE_PUBLISHABLE_KEY"))).toBe(true);
  });

  test("C3132: the Stripe packages are exactly the two browser ones, imported only under components/billing", () => {
    const manifest = JSON.parse(read(path.join(WEB, "package.json"))) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
    const stripe = Object.keys({ ...manifest.dependencies, ...manifest.devDependencies }).filter((name) => /^(stripe|@stripe\/)/.test(name));
    expect(stripe.sort()).toEqual(["@stripe/react-stripe-js", "@stripe/stripe-js"]);
    const importing = sources().filter((file) => /from\s+["']@stripe\//.test(read(file)));
    expect(importing.length).toBeGreaterThan(0);
    expect(importing.filter((file) => !rel(file).startsWith("components/billing/")).map(rel)).toEqual([]);
  });

  test("C3133: .env.example documents the publishable key beside the secret key", () => {
    const example = read(path.join(WEB, ".env.example"));
    expect(example).toMatch(/^STRIPE_PUBLISHABLE_KEY=/m);
    expect(example).toContain("pk_");
    expect(example).toMatch(/publishable[\s\S]*browser|browser[\s\S]*publishable/i);
    expect(example).toMatch(/^STRIPE_SECRET_KEY=/m);
    expect(example).toContain("APP_BASE_URL");
    expect(example).toContain("stripe_webhook_secret");
  });

  test("C3134: no input of ours collects a card number, expiry or CVC, and the card field is Stripe's Payment Element", () => {
    const screens = sources().filter((file) => /^(app|components)\//.test(rel(file)) && !isTest(file));
    const own = /(name|id|htmlFor|autoComplete)=["'](cardNumber|card_number|cc-number|cc-csc|cc-exp|cvc|cvv|cardExpiry|expiry)["']/i;
    expect(screens.filter((file) => own.test(read(file))).map(rel)).toEqual([]);
    expect(screens.some((file) => rel(file).startsWith("components/billing/") && read(file).includes("PaymentElement"))).toBe(true);
  });

  test("C3137: the billing components read no environment and hold no secret", () => {
    const files = sources().filter((file) => rel(file).startsWith("components/billing/") && !isTest(file));
    expect(files.length).toBeGreaterThan(0);
    expect(files.filter((file) => /process\.env|STRIPE_SECRET_KEY|sk_(test|live)_/.test(read(file))).map(rel)).toEqual([]);
  });
});
