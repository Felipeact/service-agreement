import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import type { AgreementDetail, MemberRole, ServiceLineView } from "@/application/ports";
import type { AgreementStatus } from "@/domain/agreement";
import { pipelineStage } from "@/domain/pipeline";
import { AgreementView, type AgreementActions } from "./agreement-view";
import { LineForm } from "./line-form";
import { RemovePrompt } from "./line-row";
import { RevisePrompt, WithdrawPrompt } from "./move-controls";
import type { LineState, MoveState } from "./state";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }), usePathname: () => "/agreements" }));

const STATUSES: AgreementStatus[] = ["draft", "sent", "accepted", "refused", "changes_requested", "expired", "withdrawn"];

const LINES: ServiceLineView[] = [
  { id: "l1", position: 0, description: "Preventive maintenance visit", visitsPerYear: 4, costPerVisitCents: 89250, annualCents: 357000 },
  { id: "l2", position: 1, description: "Filter changes", visitsPerYear: 2, costPerVisitCents: 15000, annualCents: 30000 },
];

function agreement(over: { status?: AgreementStatus; lines?: ServiceLineView[]; shownNo?: number; versions?: number } = {}): AgreementDetail {
  const status = over.status ?? "draft";
  const count = over.versions ?? 2;
  const shownNo = over.shownNo ?? count;
  const lines = over.lines ?? LINES;
  return {
    id: "g1",
    number: "AG-1052",
    status,
    stage: pipelineStage(status),
    site: { id: "s1", name: "Harbourview Towers" },
    customer: { id: "c1", name: "Harbourview Strata" },
    versions: Array.from({ length: count }, (_, i) => ({ versionNo: count - i, createdAt: new Date(Date.UTC(2026, 9, 20 + count - i, 18)) })),
    shown: { versionNo: shownNo, current: shownNo === count, lines, annualCents: lines.reduce((t, l) => t + l.annualCents, 0) },
    editable: status === "draft" && shownNo === count,
  };
}

const actions: AgreementActions = {
  add: async () => ({ status: "saved" }),
  update: () => async () => ({ status: "saved" }),
  remove: () => async () => ({ status: "removed" }),
  revise: async () => ({ status: "idle" }),
  withdraw: async () => ({ status: "withdrawn" }),
};

const view = (a: AgreementDetail, role: MemberRole = "estimator") => renderToStaticMarkup(createElement(AgreementView, { agreement: a, role, actions }));
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/\s+/g, " ");
const has = (html: string, label: string) => new RegExp(`<button[^>]*>${label}</button>`).test(html);

describe("the agreement view", () => {
  test("C713: number, stage, customer and site links, version, lines and the total", () => {
    const html = view(agreement());
    const out = text(html);
    expect(html).toContain(">AG-1052</h1>");
    expect(html).toMatch(/data-stage-dot="in_progress"[^>]*><\/span>In progress/);
    expect(html).toMatch(/<a[^>]*href="\/customers\/c1"[^>]*>Harbourview Strata<\/a>/);
    expect(html).toMatch(/<a[^>]*href="\/sites\/s1"[^>]*>Harbourview Towers<\/a>/);
    expect(out).toContain("Version 2");
    for (const piece of ["Preventive maintenance visit", "Filter changes", "$892.50", "$150.00", "$3,570.00", "$300.00"]) expect(out, piece).toContain(piece);
    expect(out).toMatch(/Visits per year: 4 /);
    expect(out).toMatch(/Visits per year: 2 /);
    expect(out).toContain("Total per year $3,870.00");
    expect(out).toContain("Before tax");
  });

  test("the line columns are headed from md up, where the per-line labels are hidden", () => {
    const html = view(agreement());
    const head = /<div[^>]*data-line-head[^>]*>.*?<\/div>/.exec(html)?.[0] ?? "";
    expect(head).toMatch(/class="[^"]*\bhidden\b[^"]*\bmd:grid\b/);
    expect(text(head).trim()).toBe("Description Visits per year Per visit Per year");
    expect(view(agreement({ lines: [] }))).not.toContain("data-line-head");
  });

  test("C715: an empty editable version says so; writers get the add form pre-filled, viewers no form", () => {
    const empty = agreement({ lines: [] });
    const writer = view(empty);
    expect(text(writer)).toContain("No service lines yet.");
    expect(writer).toMatch(/id="new-line-description"[^>]*value="Preventive maintenance visit"/);
    expect(writer).toMatch(/id="new-line-visitsPerYear"[^>]*value="4"/);
    expect(writer).toMatch(/id="new-line-costPerVisit"[^>]*value=""/);
    const viewer = view(empty, "viewer");
    expect(text(viewer)).toContain("No service lines yet.");
    expect(viewer).not.toContain("<form");
  });

  const cases = (["estimator", "viewer"] as const).flatMap((role) =>
    STATUSES.flatMap((status) => (["current", "past"] as const).map((version) => [role, status, version] as const)),
  );

  test.each(cases)("C716: %s, %s, %s version", (role, status, version) => {
    const html = view(agreement({ status, shownNo: version === "current" ? 2 : 1 }), role);
    const shown = role === "estimator" && status === "draft" && version === "current";
    for (const label of ["Add line", "Edit", "Remove"]) expect(has(html, label), label).toBe(shown);
  });

  test("C726: versions newest first with their dates, Current on the latest, each linking to ?version=<n>", () => {
    const a = agreement({ versions: 3 });
    const html = view(a);
    expect([...html.matchAll(/data-version="(\d+)"/g)].map((m) => m[1])).toEqual(["3", "2", "1"]);
    const date = new Intl.DateTimeFormat("en-CA", { dateStyle: "medium", timeZone: "America/Vancouver" });
    for (const version of a.versions) {
      const item = html.match(new RegExp(`<li[^>]*data-version="${version.versionNo}"[^>]*>.*?</li>`))?.[0] ?? "";
      expect(item).toMatch(new RegExp(`<a[^>]*href="/agreements/g1\\?version=${version.versionNo}"`));
      expect(item).toContain(date.format(version.createdAt));
      expect(item.includes(">Current<"), String(version.versionNo)).toBe(version.versionNo === 3);
    }
    expect(view(agreement({ versions: 1 }))).not.toContain("data-version");
  });

  test("C728: a past version of a draft is read-only for a writer", () => {
    const html = view(agreement({ versions: 3, shownNo: 1 }));
    expect(text(html)).toContain("Version 1 of 3, read-only");
    for (const label of ["Add line", "Edit", "Remove"]) expect(has(html, label), label).toBe(false);
  });

  test.each((["estimator", "viewer"] as const).flatMap((role) => STATUSES.map((status) => [role, status] as const)))(
    "C729: Start version 3 for %s on %s",
    (role, status) => {
      expect(has(view(agreement({ status }), role), "Start version 3")).toBe(role === "estimator" && status === "changes_requested");
    },
  );

  test.each((["estimator", "viewer"] as const).flatMap((role) => STATUSES.map((status) => [role, status] as const)))(
    "C732: Withdraw for %s on %s",
    (role, status) => {
      expect(has(view(agreement({ status }), role), "Withdraw")).toBe(role === "estimator" && (status === "draft" || status === "sent"));
    },
  );

  test("C732: the withdraw prompt asks, then submits Withdraw, with a Cancel that does not submit", () => {
    const html = renderToStaticMarkup(createElement(WithdrawPrompt, { number: "AG-1052", confirming: true, pending: false, state: { status: "idle" } }));
    expect(text(html)).toContain("Withdraw AG-1052? It leaves the pipeline and frees the site for a new agreement.");
    expect(html).toMatch(/<form[^>]*>.*<button type="submit"[^>]*>Withdraw<\/button>/);
    expect(html).toMatch(/<button type="button"[^>]*>Cancel<\/button>/);
  });

  test("C734: a non-draft agreement says its status label, read-only", () => {
    expect(text(view(agreement({ status: "sent" })))).toContain("Sent to customer, read-only");
    expect(text(view(agreement({ status: "withdrawn" })))).toContain("Withdrawn, read-only");
  });
});

describe("the line form and prompts", () => {
  const form = (state: LineState) =>
    renderToStaticMarkup(
      createElement(LineForm, {
        idPrefix: "new-line",
        initial: { description: "", visitsPerYear: "", costPerVisit: "" },
        state,
        pending: false,
        submitLabel: "Add line",
      }),
    );

  test("C721: a cost message sits under the cost field, linked by aria-describedby", () => {
    const html = form({
      status: "invalid",
      errors: { costPerVisit: "Enter a cost per visit from $0 to $999,999.99" },
      values: { description: "PM", visitsPerYear: "4", costPerVisit: "abc" },
    });
    expect(html).toMatch(/<input id="new-line-costPerVisit"[^>]*aria-describedby="new-line-costPerVisit-error"/);
    expect(html).toMatch(/<p id="new-line-costPerVisit-error"[^>]*>Enter a cost per visit from \$0 to \$999,999\.99<\/p>/);
    expect(html).toMatch(/id="new-line-costPerVisit"[^>]*value="abc"/);
  });

  test("C722: too_many says the 50-line limit", () => {
    expect(form({ status: "too_many" })).toMatch(/role="alert"[^>]*>An agreement version can have at most 50 lines\.</);
  });

  test("C723: the remove prompt asks before it removes", () => {
    const html = renderToStaticMarkup(
      createElement(RemovePrompt, { description: "Filter changes", confirming: true, pending: false, state: { status: "idle" } }),
    );
    expect(text(html)).toContain("Remove Filter changes?");
    expect(html).toMatch(/<form[^>]*>.*<button type="submit"[^>]*>Remove<\/button>/);
    expect(html).toMatch(/<button type="button"[^>]*>Cancel<\/button>/);
    const idle = renderToStaticMarkup(
      createElement(RemovePrompt, { description: "Filter changes", confirming: false, pending: false, state: { status: "idle" } }),
    );
    expect(idle).not.toContain('type="submit"');
  });

  test("C737: locked is said on the line form and on the remove prompt", () => {
    expect(form({ status: "locked" })).toMatch(/role="alert"[^>]*>This version can no longer be changed\.</);
    const prompt = renderToStaticMarkup(
      createElement(RemovePrompt, { description: "Filter changes", confirming: false, pending: false, state: { status: "locked" } }),
    );
    expect(prompt).toMatch(/role="alert"[^>]*>This version can no longer be changed\.</);
  });

  test("C743: a stale revise or withdraw says to reload", () => {
    const conflict: MoveState = { status: "conflict" };
    const message = /role="alert"[^>]*>This agreement changed meanwhile\. Reload to see it\.</;
    expect(renderToStaticMarkup(createElement(RevisePrompt, { nextVersion: 3, pending: false, state: conflict }))).toMatch(message);
    expect(renderToStaticMarkup(createElement(WithdrawPrompt, { number: "AG-1052", confirming: false, pending: false, state: conflict }))).toMatch(message);
  });

  test("C744: unavailable says to try again", () => {
    expect(form({ status: "unavailable" }).replace(/&#x27;/g, "'")).toMatch(/role="alert"[^>]*>We couldn't save this\. Try again\.</);
  });
});
