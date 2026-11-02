import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import type { AgreementDetail, MemberRole } from "@/application/ports";
import type { AgreementTerm } from "@/domain/agreement";
import { AgreementView, type AgreementActions } from "./agreement-view";
import { linkMessageFor } from "./state";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }), usePathname: () => "/agreements" }));

function agreement(term: AgreementTerm, editable = true): AgreementDetail {
  return {
    id: "g1",
    number: "AG-1052",
    status: editable ? "draft" : "sent",
    stage: editable ? "in_progress" : "sent",
    site: { id: "s1", name: "Harbourview Towers" },
    customer: { id: "c1", name: "Harbourview Strata" },
    versions: [{ versionNo: 1, createdAt: new Date(Date.UTC(2026, 9, 20, 18)) }],
    shown: { versionNo: 1, current: true, lines: [], annualCents: 0 },
    editable,
    equipmentChoices: [],
    serviceScope: { source: "live", takenAt: null, types: [] },
    terms: null,
    term,
    validUntil: null,
    portalLink: null,
    linkEmail: null,
    renews: null,
    renewedBy: null,
  };
}

const actions: AgreementActions = {
  add: async () => ({ status: "saved" }),
  update: () => async () => ({ status: "saved" }),
  remove: () => async () => ({ status: "removed" }),
  revise: async () => ({ status: "idle" }),
  withdraw: async () => ({ status: "withdrawn" }),
  send: async () => ({ status: "idle" }),
  reissue: async () => ({ status: "idle" }),
  saveTerm: async () => ({ status: "saved" }),
};

const view = (a: AgreementDetail, role: MemberRole = "estimator") => renderToStaticMarkup(createElement(AgreementView, { agreement: a, role, actions }));
const termSection = (html: string) => html.match(/<section aria-label="Term"[\s\S]*?<\/section>/)?.[0] ?? "";
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

const NO_START: AgreementTerm = { start: null, months: 12, end: null };
const SET: AgreementTerm = { start: "2027-01-01", months: 12, end: "2027-12-31" };

describe("the Term section", () => {
  test("C1146: a draft with no start shows Start date not set and 12 months, with inputs for a writer", () => {
    const section = termSection(view(agreement(NO_START)));
    expect(text(section)).toContain("Start date not set");
    expect(text(section)).toContain("12 months");
    expect(section).toMatch(/<input[^>]*name="termStart"[^>]*type="date"|<input[^>]*type="date"[^>]*name="termStart"/);
    expect(section).toMatch(/<input[^>]*name="termMonths"/);
  });

  test("C1146: a draft with a start shows the dates and months", () => {
    expect(text(termSection(view(agreement(SET))))).toContain("Term: Jan 1, 2027 – Dec 31, 2027 · 12 months");
  });

  test("C1146: a viewer, and a version that is not editable, get no term inputs", () => {
    for (const html of [view(agreement(SET), "viewer"), view(agreement(SET, false))]) {
      const section = termSection(html);
      expect(text(section)).toContain("Term: Jan 1, 2027 – Dec 31, 2027 · 12 months");
      expect(section).not.toContain("<input");
    }
  });
});

describe("the send alert", () => {
  test("C1150: no_term_start asks for the start date", () => {
    expect(linkMessageFor("no_term_start")).toContain("Set the term start date before sending");
  });
});
