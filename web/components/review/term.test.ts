import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { portalView } from "@/application/portal-view.testing";
import type { PortalView } from "@/application/ports";
import { ReviewView } from "./review-view";

const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/\s+/g, " ");

const html = (over: Partial<PortalView>) =>
  text(
    renderToStaticMarkup(
      createElement(ReviewView, {
        token: "t",
        view: portalView(over),
        state: "open",
        actions: { decide: async () => ({ status: "idle" as const }), record: async () => undefined },
      }),
    ),
  );

const FROZEN = { repairDiscountPct: 10, cpiCapPct: 3, cancellationNoticeDays: 30, paymentDays: 30, governingProvince: "BC", taxNote: null };

describe("the review page's term", () => {
  test("C1156: the term line and the Renewal row from the frozen values", () => {
    const out = html({
      term: { start: "2027-01-01", months: 12, end: "2027-12-31" },
      terms: { ...FROZEN, renewalNoticeDays: 30, cpiRenegotiationThresholdPct: 5 },
    });
    expect(out).toContain("Term: Jan 1, 2027 – Dec 31, 2027 (12 months)");
    expect(out).toContain(
      "Renewal Renews automatically for another 12 months with the CPI increase, capped at 3%. If CPI is 5% or more, the renewal is renegotiated. Notice is given 30 days before the end date.",
    );
  });

  test("C1156: a version with no start says it was not recorded", () => {
    expect(html({ term: { start: null, months: 12, end: null } })).toContain("Term: not recorded for this version");
  });
});
