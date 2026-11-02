import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import type { ExpiringAgreement } from "@/domain/pipeline";
import type { PipelineCard } from "@/application/ports";
import { ExpiringView } from "./expiring-view";
import { PipelineView } from "./pipeline-view";

const row: ExpiringAgreement = {
  id: "a1",
  number: "AG-1004",
  site: "Harbourview Towers",
  customer: "Harbourview Strata",
  termEnd: "2027-12-31",
  noticeDate: "2027-12-15",
  annualCents: 119999,
  renewal: null,
  openAgreement: null,
};

const html = (rows: ExpiringAgreement[]) => renderToStaticMarkup(createElement(ExpiringView, { rows, today: "2027-12-01" })).replace(/&#x27;/g, "'");
const text = (markup: string) => markup.replace(/<!-- -->/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

describe("ExpiringView", () => {
  test("C1212: one row per agreement with site, customer, number, end date, annual total and its label", () => {
    const out = html([row, { ...row, id: "a2", number: "AG-1005", renewal: { id: "r", number: "AG-1013", status: "accepted" } }]);
    expect(out.match(/data-expiring/g)).toHaveLength(2);
    const words = text(out);
    for (const part of ["Harbourview Towers", "Harbourview Strata", "AG-1004", "Dec 31, 2027", "$1,199.99", "Renews on Dec 15, 2027: automatic or renegotiated by CPI", "Auto-renewed as AG-1013"]) {
      expect(words).toContain(part);
    }
  });

  test("C1212: with no rows it says so", () => {
    expect(text(html([]))).toContain("No agreements end in the next 90 days.");
    expect(html([])).not.toContain("data-expiring");
  });

  test("C1213: Expiring soon links back to the board, and the board links to Expiring soon", () => {
    expect(html([])).toMatch(/<a[^>]*href="\/pipeline"[^>]*>Back to the board<\/a>/);
    const card: PipelineCard = { id: "c", stage: "sent", site: "S", customer: "C", number: "AG-1", versionNo: 1, ageDays: 0, isRenewal: false };
    const board = renderToStaticMarkup(createElement(PipelineView, { cards: [card] }));
    expect(board).toMatch(/<a[^>]*href="\/pipeline\?view=expiring"[^>]*>Expiring soon<\/a>/);
  });
});
