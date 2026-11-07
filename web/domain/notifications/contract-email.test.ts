import { describe, expect, test } from "vitest";
import { contractReadyEmail, signedCopyEmail, signingLinkEmail, staffContractSignedEmail, type ContractRefusal } from "./index";

const tenant = { legalName: "Northwind Mechanical Ltd.", phone: "604-555-0100", accent: null };
const agreement = { id: "agr-1", number: "AG-1052" };
const BASE = "https://agreements.northwind.ca";

const REFUSALS: [ContractRefusal, string][] = [
  ["not_accepted", "the agreement is no longer accepted"],
  ["auto_renewal", "it renewed on its own, so there is nothing to sign"],
  ["site_inactive", "the site is inactive"],
  ["no_term_start", "the agreement has no start date"],
  ["no_signer", "nobody at the site has an email address to sign"],
];

describe("contract-ready email (W2a)", () => {
  test("C1788: a made contract names the tenant, the number and the site, and has one button to /contracts/<id>", () => {
    const email = contractReadyEmail({ appBaseUrl: BASE, tenant, agreement, siteName: "Harbourview Towers", contract: { id: "con-9" }, refusal: null });
    expect(email.subject).toBe("AG-1052 was accepted: the contract is ready to send (Northwind Mechanical Ltd.)");
    expect(email.text).toContain("AG-1052");
    expect(email.text).toContain("Harbourview Towers");
    expect(email.text).toContain(`Open the contract: ${BASE}/contracts/con-9`);
    expect(email.html.match(/<a /g)).toHaveLength(1);
    expect(email.html).toContain(`href="${BASE}/contracts/con-9"`);
  });

  test.each(REFUSALS)("C1785: the refusal %s says why in plain words and links to the agreement, not the contract", (refusal, words) => {
    const email = contractReadyEmail({ appBaseUrl: BASE, tenant, agreement, siteName: "Harbourview Towers", contract: null, refusal });
    expect(email.subject).toBe("AG-1052 was accepted, but the contract could not be made (Northwind Mechanical Ltd.)");
    expect(email.text).toContain(`because ${words}.`);
    expect(email.text).toContain(`Open AG-1052: ${BASE}/agreements/agr-1`);
    expect(email.html).not.toContain("/contracts/");
    expect(email.html).not.toContain("/sign/");
    expect(email.text).not.toContain("/sign/");
  });

  test("C1785: a made contract links to /contracts/<id> and neither version contains /sign/", () => {
    const email = contractReadyEmail({ appBaseUrl: `${BASE}//`, tenant, agreement, siteName: "Harbourview Towers", contract: { id: "con-9" }, refusal: null });
    expect(email.html).toContain(`href="${BASE}/contracts/con-9"`);
    expect(email.html + email.text).not.toContain("/sign/");
  });
});

describe("signing-link email (W2b)", () => {
  const input = { tenant, agreementNumber: "AG-1052", siteName: "Harbourview Towers", signerName: "Pat Lee", signingUrl: `${BASE}/sign/tok-1` };

  test("C1799: it names the tenant, number and site, has one button to the address given, and says the customer signs on that page", () => {
    const email = signingLinkEmail(input);
    expect(email.subject).toBe("Please sign service agreement AG-1052 from Northwind Mechanical Ltd.");
    expect(email.html.match(/<a /g)).toHaveLength(1);
    expect(email.html).toContain(`href="${BASE}/sign/tok-1"`);
    expect(email.text).toContain(`Review and sign the contract: ${BASE}/sign/tok-1`);
    expect(email.text).toContain("Harbourview Towers");
    expect(email.text).toContain("You read it and sign it on that page.");
    expect(email.text).toContain("Questions? Call Northwind Mechanical Ltd. at 604-555-0100.");
  });

  test("C1799: without a phone it says to reply, and a name with markup is escaped in the html", () => {
    const email = signingLinkEmail({ ...input, tenant: { ...tenant, phone: null }, signerName: "<b>Pat</b>" });
    expect(email.text).toContain("Questions? Reply to this email.");
    expect(email.html).toContain("&lt;b&gt;Pat&lt;/b&gt;");
    expect(email.html).not.toContain("<b>Pat</b>");
  });
});

describe("signed-copy emails (W4)", () => {
  test("C1809: the party's email says both signed, names both attachments and links nothing that signs", () => {
    const email = signedCopyEmail({ tenant, agreementNumber: "AG-1052", siteName: "Harbourview Towers", signerName: "Pat Lee" });
    expect(email.subject).toBe("Signed contract for service agreement AG-1052 (Northwind Mechanical Ltd.)");
    expect(email.text).toContain("is signed by both parties");
    expect(email.text).toContain("AG-1052-signed.pdf");
    expect(email.text).toContain("AG-1052-audit-log.pdf");
    expect(email.html).not.toContain("<a ");
    expect(email.html + email.text).not.toContain("/sign/");
  });

  test("C1809: the staff note links to /contracts/<id>", () => {
    const email = staffContractSignedEmail({ appBaseUrl: BASE, agreement, contract: { id: "con-9" }, siteName: "Harbourview Towers", customerName: "Fernwood Dental" });
    expect(email.subject).toBe("AG-1052 is signed by both parties");
    expect(email.text).toContain(`Open the contract: ${BASE}/contracts/con-9`);
    expect(email.html).toContain(`href="${BASE}/contracts/con-9"`);
  });
});
