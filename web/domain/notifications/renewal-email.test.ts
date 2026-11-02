import { describe, expect, test } from "vitest";
import { customerRenewalEmail, staffRenewalEmail, type RenewalReason } from ".";

const tenant = { legalName: "Kettle <Ridge> Mechanical", phone: "604-555-0100", accent: null };

describe("renewal emails", () => {
  test("C1192: customer_renewal names the start, both totals, the applied % and the new term", () => {
    const email = customerRenewalEmail({
      tenant,
      agreementNumber: "AG-1013",
      renewsNumber: "AG-1004",
      siteName: "Harbour & Main",
      oldAnnualCents: 119999,
      annualCents: 123839,
      appliedPct: 3.2,
      term: { start: "2028-01-01", end: "2028-12-31", months: 12 },
    });
    expect(email.subject).toBe("Your service agreement renews on Jan 1, 2028");
    for (const part of ["$1,199.99", "$1,238.39", "3.2%", "Jan 1, 2028 – Dec 31, 2028"]) expect(email.text).toContain(part);
    expect(email.html).toContain("Kettle &lt;Ridge&gt; Mechanical");
    expect(email.html).toContain("Harbour &amp; Main");
    expect(email.html).not.toContain("<Ridge>");
  });

  const staff = (reason: RenewalReason) =>
    staffRenewalEmail({
      appBaseUrl: "https://app.example.ca/",
      agreement: { id: "r1", number: "AG-1013" },
      renews: { number: "AG-1004", termEnd: "2027-12-31" },
      siteName: "Harbour & Main",
      customerName: "<Strata> 12",
      reason,
    });

  test("C1192: staff_renewal names the draft and the old end, and links to the draft", () => {
    const email = staff("cpi_unset");
    expect(email.subject).toBe("AG-1013 needs renegotiation before Dec 31, 2027");
    expect(email.text).toContain("https://app.example.ca/agreements/r1");
    expect(email.html).toContain("&lt;Strata&gt; 12");
    expect(email.html).not.toContain("<Strata>");
  });

  test("C1192: each of the three reasons has a sentence of its own", () => {
    const reasons: RenewalReason[] = ["at_threshold", "cpi_unset", "cpi_stale"];
    const own = reasons.map((reason) => {
      const others = reasons.filter((r) => r !== reason).map((r) => staff(r).text);
      return staff(reason).text.split("\n").filter((line) => line !== "" && others.every((text) => !text.includes(line)));
    });
    for (const lines of own) expect(lines).toHaveLength(1);
    expect(new Set(own.flat()).size).toBe(3);
  });
});
