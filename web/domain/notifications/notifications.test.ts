import { describe, expect, test } from "vitest";
import { customerEmail, escapeHtml, isReservedAddress, notEmailedWords, staffDecisionEmail, staleEmail, type CustomerEmailInput } from "./index";

const BASE = "https://agreements.northwind.ca";
const TOKEN = "U-FVzrQONnE0OeSkuG3mDhLni8aAqblTz4-KLseYCj4";
const tenant = { legalName: "Northwind Mechanical Ltd.", phone: "604-555-0100", accent: "#0f766e" };

const input = (over: Partial<CustomerEmailInput> = {}): CustomerEmailInput => ({
  tenant,
  agreementNumber: "AG-1052",
  siteName: "Harbourview Towers",
  annualCents: 387000,
  reviewUrl: `${BASE}/review/${TOKEN}`,
  reminder: null,
  ...over,
});

/** The `href` of the anchor whose text is `label`. */
const hrefOf = (html: string, label: string) => new RegExp(`<a href="([^"]+)"[^>]*>${label}</a>`).exec(html)?.[1];

describe("customer emails", () => {
  test("C1019: the link email names the tenant, the agreement, the site, the total before tax and the phone", () => {
    const email = customerEmail(input());
    expect(email.subject).toBe("Service agreement AG-1052 from Northwind Mechanical Ltd.");
    expect(hrefOf(email.html, "Review the agreement")).toBe(`${BASE}/review/${TOKEN}`);
    for (const body of [email.html, email.text]) {
      expect(body).toContain("Harbourview Towers");
      expect(body).toMatch(/\$3,870\.00[^<\n]*before tax/);
      expect(body).toContain("604-555-0100");
      expect(body).toContain("Northwind Mechanical Ltd.");
      expect(body).not.toContain("Service Agreement");
      expect(body).not.toContain("felipeviana");
    }
    expect(email.text).toContain(`Review the agreement: ${BASE}/review/${TOKEN}`);
  });

  test("C1019: with phone null there is no null or undefined text", () => {
    const email = customerEmail(input({ tenant: { ...tenant, phone: null }, reviewUrl: `https://agreements.example.ca/review/${TOKEN}` }));
    for (const body of [email.html, email.text, email.subject]) {
      expect(body).not.toContain("null");
      expect(body).not.toContain("undefined");
    }
  });

  test.each(["day3", "day7"] as const)("C1020: the %s reminder has the reminder subject and the same body facts", (reminder) => {
    const email = customerEmail(input({ reminder }));
    expect(email.subject).toBe("Reminder: service agreement AG-1052 from Northwind Mechanical Ltd.");
    expect(hrefOf(email.html, "Review the agreement")).toBe(`${BASE}/review/${TOKEN}`);
    expect(email.html).toContain("Harbourview Towers");
    expect(email.html).toMatch(/\$3,870\.00[^<]*before tax/);
    expect(email.html).toContain("604-555-0100");
    expect(email.text).not.toContain("Service Agreement");
  });

  test("C1019: names from the database are HTML-escaped", () => {
    const email = customerEmail(input({ siteName: `<script>alert("x")</script>`, tenant: { ...tenant, legalName: "A & B" } }));
    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
    expect(email.html).toContain("A &amp; B");
    expect(escapeHtml(`'`)).toBe("&#39;");
  });
});

describe("staff emails", () => {
  const decision = { appBaseUrl: `${BASE}/`, agreement: { id: "a1", number: "AG-1052" }, customerName: "Harbourview Strata" };

  test("C1027: a refusal names the customer and number, quotes the reason and links to the agreement", () => {
    const email = staffDecisionEmail({ ...decision, decision: "refused", reason: "Too expensive" });
    expect(email.subject).toBe("Harbourview Strata refused AG-1052");
    expect(email.html).toContain("Too expensive");
    expect(email.text).toContain("Too expensive");
    expect(email.html).toContain(`href="${BASE}/agreements/a1"`);
    expect(email.text).toContain(`${BASE}/agreements/a1`);
  });

  test("C1027: a change request names the customer and number, quotes the reason and links to the agreement", () => {
    const email = staffDecisionEmail({ ...decision, decision: "changes_requested", reason: "Add the boiler" });
    expect(email.subject).toBe("Harbourview Strata asked for changes to AG-1052");
    expect(email.html).toContain("Add the boiler");
    expect(email.html).toContain(`href="${BASE}/agreements/a1"`);
  });

  test("C1029: the stale digest counts, lists each agreement with customer and send date, and links each number", () => {
    const agreements = [
      { id: "a1", number: "AG-1039", customerName: "Harbourview Strata", sentAt: new Date("2026-10-21T17:00:00Z") },
      { id: "a2", number: "AG-1042", customerName: "Kingsway Dental", sentAt: new Date("2026-10-20T17:00:00Z") },
    ];
    const email = staleEmail({ appBaseUrl: BASE, agreements });
    expect(email.subject).toBe("2 agreements not viewed after 7 days");
    expect(hrefOf(email.html, "AG-1039")).toBe(`${BASE}/agreements/a1`);
    expect(hrefOf(email.html, "AG-1042")).toBe(`${BASE}/agreements/a2`);
    expect(email.html).toContain("Harbourview Strata");
    expect(email.html).toContain("Kingsway Dental");
    expect(email.html).toContain("Oct 21, 2026");
    expect(email.html).toContain("Oct 20, 2026");
    expect(email.text).toContain(`AG-1039 · Harbourview Strata · sent Oct 21, 2026: ${BASE}/agreements/a1`);
    expect(staleEmail({ appBaseUrl: BASE, agreements: agreements.slice(0, 1) }).subject).toBe("1 agreement not viewed after 7 days");
  });
});

describe("reserved recipients and reasons", () => {
  test.each(["a@example.com", "a@example.org", "a@example.net", "a@shop.test", "a@x.invalid", "A@EXAMPLE.COM"])("C1024: %s is reserved", (address) => {
    expect(isReservedAddress(address)).toBe(true);
  });

  test.each(["a@felipeviana.com", "a@notexample.com", "a@example.community"])("C1024: %s is not reserved", (address) => {
    expect(isReservedAddress(address)).toBe(false);
  });

  test("C1032: each reason has distinct words with no underscore", () => {
    const reasons = ["no_recipient", "no_link_secret", "reserved_domain", "failed"] as const;
    const words = reasons.map(notEmailedWords);
    expect(new Set(words).size).toBe(4);
    for (const phrase of words) {
      expect(phrase.length).toBeGreaterThan(0);
      expect(phrase).not.toContain("_");
    }
  });
});
