import { describe, expect, test } from "vitest";
import { buildTemplatePreviewDocument, SYSTEM_AGREEMENT_BODY } from "@/domain/agreement";
import { itemWords, type OrgSettingsValue } from "@/domain/org-settings";
import { buildStarterContractPreview } from "./starter-preview";
import type { TemplateBody } from "./template";

const settings: OrgSettingsValue = {
  legalName: "Flow Plumbing Ltd.",
  address: "12 Pipe St, Vancouver",
  phone: "604-555-0123",
  accentColor: "#1f6f8b",
  repairDiscountPct: 0,
  cpiCapPct: 5,
  cancellationNoticeDays: 30,
  paymentDays: 30,
  governingProvince: "BC",
  taxNote: null,
  defaultTermMonths: 12,
  renewalNoticeDays: 30,
  cpiRenegotiationThresholdPct: 5,
  renewalCpiPct: null,
  renewalCpiAsOf: null,
  proposalValidityDays: 30,
  itemSingular: "equipment",
  itemPlural: "equipment",
};
const words = itemWords("equipment", "equipment");

const EXPECTED = [
  { type: "heading", text: "Terms" },
  { type: "clause", text: "Invoices are payable within 30 days." },
  { type: "clause", text: "Either party may cancel this contract with 30 days' written notice." },
  { type: "clause", text: "Repair work is discounted by 0%." },
  { type: "clause", text: "The annual price may rise with CPI, capped at 5%." },
  { type: "clause", text: "This contract is governed by the laws of British Columbia." },
];

describe("starter contract preview", () => {
  test("C5507: a new org's terms fill every variable of the system wording, in order", () => {
    const blocks = buildStarterContractPreview(settings);
    expect(blocks).toHaveLength(7);
    expect(blocks.slice(0, 6)).toEqual(EXPECTED);
    expect(blocks[6].type).toBe("clause");
    expect(blocks[6].text).toMatch(/^This contract renews for successive .+ terms unless CPI is at or above 5%, when the parties renegotiate; the customer is notified 30 days before the end date\.$/);
  });

  test.each([
    ["paymentDays", "Invoices are payable"],
    ["cancellationNoticeDays", "Either party may cancel"],
    ["governingProvince", "governed by the laws"],
  ] as const)("C5508: %s unset drops only its clause", (field, start) => {
    const blocks = buildStarterContractPreview({ ...settings, [field]: null });
    expect(blocks.some((block) => block.text.includes(start))).toBe(false);
    expect(blocks).toHaveLength(6);
    const expected = EXPECTED.filter((block) => !block.text.includes(start));
    expect(blocks.slice(0, 5)).toEqual(expected);
  });

  test("C5509: sample customer and site names fill their variables", () => {
    const body: TemplateBody = { schema: 1, blocks: [{ type: "paragraph", text: "{{customer.name}} at {{site.name}}." }] };
    expect(buildStarterContractPreview(settings, body)).toEqual([{ type: "paragraph", text: "Sample Customer Ltd. at Sample Site." }]);
  });
});

describe("starter agreement preview document", () => {
  test("C5505: letterhead, logo, mark and saved terms come from the org", () => {
    const logo = { bytes: new Uint8Array([137, 80, 78, 71]), format: "png" as const };
    const document = buildTemplatePreviewDocument(SYSTEM_AGREEMENT_BODY, settings, logo, words);
    expect(document.tenant.name).toBe("Flow Plumbing Ltd.");
    expect(document.tenant.address).toBe("12 Pipe St, Vancouver");
    expect(document.tenant.phone).toBe("604-555-0123");
    expect(document.tenant.logo).toEqual(logo);
    expect(document.mark).toBe("TEMPLATE PREVIEW");
    expect(document.terms.map((term) => term.value).join(" ")).toContain("30");
    expect(document.terms.length).toBeGreaterThan(0);
  });
});
