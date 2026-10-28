import { createHash } from "node:crypto";
import type { PortalTokens, PortalView } from "@/application/ports";

/** The token these tests open: 43 base64url characters. */
export const TOKEN = "U-FVzrQONnE0OeSkuG3mDhLni8aAqblTz4-KLseYCj4";

const sha256 = (token: string) => createHash("sha256").update(token).digest("hex");

/** Checked against node:crypto here, not against the adapter that makes the real ones. */
export const testTokens: PortalTokens = { create: () => ({ token: TOKEN, hash: sha256(TOKEN) }), hash: sha256 };

/** A link to version 1 of AG-1052, sent, with two lines that total $3,870.00 and the six terms set. */
export function portalView(over: Partial<PortalView> = {}): PortalView {
  return {
    link: { versionNo: 1, current: true, revoked: false, revokedAt: null, firstViewedAt: null },
    agreement: { number: "AG-1052", status: "sent" },
    tenant: { name: "Kettle Ridge Mechanical Ltd.", address: "100 Sample Street, Burnaby, BC", phone: "604-555-0100", accent: "#1f6f8b" },
    customer: { name: "Fernwood Dental" },
    site: { name: "Fernwood Dental, Main" },
    lines: [
      { description: "Preventive maintenance visit", visitsPerYear: 4, costPerVisitCents: 89250, annualCents: 357000 },
      { description: "Filter changes", visitsPerYear: 2, costPerVisitCents: 15000, annualCents: 30000 },
    ],
    annualCents: 387000,
    scope: {
      schema: 1,
      takenAt: "2026-10-20T15:00:00Z",
      types: [{ code: "RTU", name: "Rooftop unit", tasks: ["Inspect belts"], assets: [{ unitNo: "RTU-1", typeModel: "Carrier 48", location: "Roof" }] }],
    },
    terms: { repairDiscountPct: 10, cpiCapPct: 5, cancellationNoticeDays: 30, paymentDays: 30, governingProvince: "BC", taxNote: "GST extra" },
    decision: null,
    ...over,
  };
}
