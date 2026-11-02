import { describe, expect, test } from "vitest";
import { staffExpiredEmail } from "./index";

const input = {
  appBaseUrl: "https://agreements.northwind.ca/",
  agreement: { id: "a1", number: "AG-1004" },
  customerName: "Acme <Holdings>",
  siteName: "Plant 2",
  validUntil: "2026-12-02",
};

describe("staff_expired email", () => {
  test("C1256: subject, text and escaped html", () => {
    const email = staffExpiredEmail(input);
    expect(email.subject).toBe("AG-1004 expired without a decision");
    expect(email.text).toContain("Acme <Holdings>");
    expect(email.text).toContain("Plant 2");
    expect(email.text).toContain("Valid until Dec 2, 2026");
    expect(email.text).toContain("https://agreements.northwind.ca/agreements/a1");
    expect(email.html).toContain("Acme &lt;Holdings&gt;");
    expect(email.html).not.toContain("Acme <Holdings>");
  });
});
