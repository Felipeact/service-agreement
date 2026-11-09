import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "vitest";

const ROOT = path.join(__dirname, "..", "..", "..");
const document = (file: string) => readFileSync(path.join(ROOT, file), "utf8");

/** The text from a heading line up to the next heading of the same or a higher level. */
function section(text: string, startLine: string, endLine: string) {
  const start = text.indexOf(startLine);
  const end = text.indexOf(endLine, start + startLine.length);
  expect(start, `${startLine} in the document`).toBeGreaterThanOrEqual(0);
  return text.slice(start, end === -1 ? undefined : end);
}

test("C2434: CONTEXT.md has a pricing-page entry under SaaS billing and a build-log line dated 2026-11-09", () => {
  const context = document("CONTEXT.md");
  const billing = section(context, "### SaaS billing (M14)", "\n### ");
  expect(billing).toContain("web/app/pricing/page.tsx");
  expect(billing).toContain("web/domain/billing");
  expect(billing).toContain("CheckoutStarter");

  const log = section(context, "## Build log", "\n## ");
  expect(log.split("\n").some((line) => line.includes("2026-11-09") && line.includes("pricing-page"))).toBe(true);
});

test("C2435: STATE.md has one active decision that names /pricing, AD-072, PLAN_KEYS, TRADE_CODES and CheckoutStarter", () => {
  const rows = document(".specs/STATE.md")
    .split("\n")
    .filter((line) => /^\| AD-\d+ \|/.test(line));
  const matching = rows.filter((row) => ["/pricing", "AD-072", "PLAN_KEYS", "TRADE_CODES", "CheckoutStarter"].every((word) => row.includes(word)));
  expect(matching).toHaveLength(1);
  expect(matching[0]).toMatch(/\| active \|/);
});
