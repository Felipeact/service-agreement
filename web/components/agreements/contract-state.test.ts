import { describe, expect, test } from "vitest";
import { CONTRACT_MESSAGES, contractMessageFor } from "./contract-state";

describe("the generate contract messages", () => {
  test("C1620: the five refusals say exactly what the plan says", () => {
    expect(CONTRACT_MESSAGES.not_accepted).toBe("Only an accepted agreement can become a contract.");
    expect(CONTRACT_MESSAGES.auto_renewal).toBe("This agreement was renewed automatically, so there is nothing to sign.");
    expect(CONTRACT_MESSAGES.site_inactive).toBe("This site is inactive.");
    expect(CONTRACT_MESSAGES.no_term_start).toBe("This agreement has no term start date, so it cannot become a contract.");
    expect(CONTRACT_MESSAGES.no_signer).toBe("Add an email to the site's approver or site contact, then try again.");
  });

  test.each(["forbidden", "not_found", "unavailable"])("C1620: %s has its own text", (status) => {
    const message = contractMessageFor(status);
    expect(message).toBeTruthy();
    expect(Object.values(CONTRACT_MESSAGES).filter((other) => other === message)).toHaveLength(1);
  });

  test("C1620: idle and anything unknown have none", () => {
    expect(contractMessageFor("idle")).toBeNull();
    expect(contractMessageFor("whatever")).toBeNull();
  });

  test.each(["not_accepted", "auto_renewal", "site_inactive", "no_term_start", "no_signer"])("C1620: contractMessageFor(%s) is its message", (status) => {
    expect(contractMessageFor(status)).toBe(CONTRACT_MESSAGES[status as keyof typeof CONTRACT_MESSAGES]);
  });
});
