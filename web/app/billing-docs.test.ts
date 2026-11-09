import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "vitest";

const ROOT = path.join(__dirname, "..", "..");
const document = (file: string) => readFileSync(path.join(ROOT, file), "utf8");
const lines = (text: string) => text.split("\n");

test("C2536: ROADMAP, CONTEXT and STATE record billing-checkout", () => {
  const roadmap = lines(document("ROADMAP.md"));
  expect(roadmap.some((line) => /^- \[x\] Stripe Checkout/.test(line) && line.includes("billing-checkout"))).toBe(true);
  expect(roadmap.some((line) => /^- \[ \] Stripe Customer Portal/.test(line))).toBe(true);

  const context = document("CONTEXT.md");
  const start = context.indexOf("### SaaS billing (M14)");
  const billing = context.slice(start, context.indexOf("\n### ", start + 10));
  for (const word of ["billing-checkout", "stripe_receive_event", "web/infrastructure/stripe", "stripe_webhook_secret"]) expect(billing, word).toContain(word);
  expect(lines(context).some((line) => line.includes("2026-11-09") && line.includes("billing-checkout"))).toBe(true);

  const rows = lines(document(".specs/STATE.md")).filter((line) => /^\| AD-\d+ \|/.test(line));
  const decision = (words: string[]) => rows.filter((row) => words.every((word) => row.includes(word)) && /\| active \|/.test(row));
  expect(decision(["infrastructure/stripe", "Stripe-Version", "STRIPE_SECRET_KEY"])).toHaveLength(1);
  expect(decision(["price_data", "metadata[plan]", "metadata[trades]"])).toHaveLength(1);
  expect(decision(["stripe_events", "stripe_receive_event", "stripe_webhook_secret"])).toHaveLength(1);
  expect(decision(["/register/success", "AD-072", "PUBLIC_PATHS"])).toHaveLength(1);
  const ad072 = rows.find((row) => row.startsWith("| AD-072 |"));
  expect(ad072).toContain("/register/success");
});
