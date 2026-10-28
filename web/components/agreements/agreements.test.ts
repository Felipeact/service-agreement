import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import type { AgreementDetail, AgreementServiceScope, MemberRole, ServiceLineView } from "@/application/ports";
import type { AgreementStatus } from "@/domain/agreement";
import { pipelineStage } from "@/domain/pipeline";
import { AgreementView, type AgreementActions } from "./agreement-view";
import { LineForm } from "./line-form";
import { RemovePrompt } from "./line-row";
import { LinkPanel, ReissuePrompt, SendPrompt } from "./link-controls";
import { RevisePrompt, WithdrawPrompt } from "./move-controls";
import type { LineState, MoveState } from "./state";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }), usePathname: () => "/agreements" }));

const STATUSES: AgreementStatus[] = ["draft", "sent", "accepted", "refused", "changes_requested", "expired", "withdrawn"];

const LINES: ServiceLineView[] = [
  { id: "l1", position: 0, description: "Preventive maintenance visit", visitsPerYear: 4, costPerVisitCents: 89250, annualCents: 357000 },
  { id: "l2", position: 1, description: "Filter changes", visitsPerYear: 2, costPerVisitCents: 15000, annualCents: 30000 },
];

function agreement(
  over: { status?: AgreementStatus; lines?: ServiceLineView[]; shownNo?: number; versions?: number; serviceScope?: AgreementServiceScope; portalLink?: AgreementDetail["portalLink"] } = {},
): AgreementDetail {
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
    serviceScope: over.serviceScope ?? { source: "live", takenAt: null, types: [] },
    terms: null,
    portalLink: over.portalLink ?? null,
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

describe("the agreement view's PDF link", () => {
  const pdfLink = (html: string) => html.match(/<a href="([^"]*\/pdf[^"]*)"[^>]*>Download PDF<\/a>/)?.[1];

  test.each<[string, Parameters<typeof agreement>[0], MemberRole, string]>([
    ["a draft's current version", { status: "draft" }, "estimator", "/agreements/g1/pdf?version=2"],
    ["a sent current version", { status: "sent" }, "estimator", "/agreements/g1/pdf?version=2"],
    ["a past version", { status: "draft", shownNo: 1 }, "estimator", "/agreements/g1/pdf?version=1"],
    ["a version with no recorded scope", { serviceScope: { source: "not_recorded" } }, "estimator", "/agreements/g1/pdf?version=2"],
    ["a viewer", { status: "sent" }, "viewer", "/agreements/g1/pdf?version=2"],
  ])("C857: %s links to its own PDF", (_name, over, role, href) => {
    const html = renderToStaticMarkup(createElement(AgreementView, { agreement: agreement(over), role, actions }));
    expect(pdfLink(html)).toBe(href);
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

describe("the agreement view: service included and equipment", () => {
  const RTU = {
    code: "RTU",
    name: "Rooftop unit",
    tasks: ["Replace filters", "Check belts"],
    assets: [
      { unitNo: "RTU-1", typeModel: "Carrier 48TC", location: "Roof" },
      { unitNo: "RTU-2", typeModel: null, location: null },
    ],
  };
  const BOILER = { code: "BOILER", name: "Boiler", tasks: ["Flow switch test"], assets: [{ unitNo: "B-1", typeModel: "Condensing", location: "P1" }] };
  const live = (types: unknown[]): AgreementServiceScope => ({ source: "live", takenAt: null, types } as AgreementServiceScope);
  const TAKEN = new Date("2026-10-27T18:00:00Z");
  const frozen = (types: unknown[]): AgreementServiceScope => ({ source: "frozen", takenAt: TAKEN, types } as AgreementServiceScope);
  const recorded = `As recorded on ${new Intl.DateTimeFormat("en-CA", { dateStyle: "medium", timeZone: "America/Vancouver" }).format(TAKEN)}`;

  /** The markup of the `<section>` labelled `label`. */
  const section = (html: string, label: string) => {
    const match = new RegExp(`<section[^>]*aria-label="${label}"[^>]*>([\\s\\S]*?)</section>`).exec(html);
    expect(match, `no section ${label}`).not.toBeNull();
    return match ? match[1] : "";
  };

  test("C805: types in order with unit counts and their tasks; equipment in closed groups per type", () => {
    const html = view(agreement({ serviceScope: live([BOILER, RTU]) }));
    const included = section(html, "Service included");
    const includedText = text(included);
    expect(includedText.indexOf("Boiler, 1 unit")).toBeGreaterThanOrEqual(0);
    expect(includedText.indexOf("Rooftop unit, 2 units")).toBeGreaterThan(includedText.indexOf("Boiler, 1 unit"));
    expect(included).toMatch(/<li[^>]*>Replace filters<\/li>\s*<li[^>]*>Check belts<\/li>/);
    expect(included).not.toContain("<details");

    const equipment = section(html, "Equipment");
    expect(equipment.match(/<details/g)).toHaveLength(2);
    expect(equipment).not.toMatch(/<details[^>]*\sopen/);
    expect(equipment).toMatch(/<summary[^>]*>[\s\S]*?Boiler · 1[\s\S]*?<\/summary>/);
    expect(equipment).toMatch(/<summary[^>]*>[\s\S]*?Rooftop unit · 2[\s\S]*?<\/summary>/);
    const equipmentText = text(equipment);
    for (const value of ["RTU-1", "Carrier 48TC", "Roof", "RTU-2", "B-1", "Condensing", "P1"]) expect(equipmentText).toContain(value);
    expect(equipmentText).toMatch(/RTU-2 — —/);
  });

  test("C806: a type with no checklist says so", () => {
    const included = text(section(view(agreement({ serviceScope: live([{ ...BOILER, tasks: [] }]) })), "Service included"));
    expect(included).toContain("Boiler, 1 unit No checklist for this type yet.");
  });

  test("C807: no equipment on the site: both sections say so, and writers get a link to the site", () => {
    const writer = view(agreement({ serviceScope: live([]) }));
    for (const label of ["Service included", "Equipment"]) expect(text(section(writer, label))).toContain("No equipment on this site yet.");
    expect(writer).toMatch(/<a[^>]*href="\/sites\/s1"[^>]*>Add equipment<\/a>/);
    const viewer = view(agreement({ serviceScope: live([]) }), "viewer");
    for (const label of ["Service included", "Equipment"]) expect(text(section(viewer, label))).toContain("No equipment on this site yet.");
    expect(viewer).not.toContain("Add equipment");
  });

  test("C815: a frozen version shows what it recorded, and when", () => {
    const html = view(agreement({ status: "sent", serviceScope: frozen([RTU]) }));
    for (const label of ["Service included", "Equipment"]) expect(text(section(html, label))).toContain(recorded);
    expect(text(section(html, "Service included"))).toContain("Rooftop unit, 2 units");
    expect(section(html, "Equipment")).toMatch(/<summary[^>]*>[\s\S]*?Rooftop unit · 2/);
    expect(html).not.toContain("Add equipment");
  });

  test("C816: a version that recorded nothing says so", () => {
    const html = view(agreement({ status: "sent", serviceScope: { source: "not_recorded" } }));
    for (const label of ["Service included", "Equipment"]) expect(text(section(html, label))).toContain("Not recorded for this version.");
    expect(html).not.toContain("As recorded on");
    expect(html).not.toContain("Add equipment");
  });

  test("C818: a frozen version with no equipment says so", () => {
    const html = view(agreement({ status: "sent", serviceScope: frozen([]) }));
    for (const label of ["Service included", "Equipment"]) {
      expect(text(section(html, label))).toContain("No equipment was recorded for this version.");
    }
    expect(html).not.toContain("Add equipment");
  });
});

describe("sending an agreement and its customer link", () => {
  const idle = { status: "idle" } as const;
  const sendPrompt = (props: Partial<Parameters<typeof SendPrompt>[0]> = {}) =>
    renderToStaticMarkup(createElement(SendPrompt, { number: "AG-1052", confirming: false, pending: false, state: idle, ...props }));

  test("C901: the link panel shows the full URL and a Copy link button", () => {
    const url = "https://app.example.com/review/" + "A".repeat(43);
    const html = renderToStaticMarkup(createElement(LinkPanel, { url }));
    expect(html).toContain(`value="${url}"`);
    expect(has(html, "Copy link")).toBe(true);
  });

  test("C901: Send to customer asks first, then submits Send, with a Cancel that does not submit", () => {
    expect(has(sendPrompt(), "Send to customer")).toBe(true);
    const html = sendPrompt({ confirming: true });
    expect(text(html)).toContain("Send AG-1052 to the customer?");
    expect(html).toMatch(/<form[^>]*>.*<button type="submit"[^>]*>Send<\/button>/);
    expect(html).toMatch(/<button type="button"[^>]*>Cancel<\/button>/);
  });

  test("C901: Send to customer is offered to a writer on the current version of a draft only", () => {
    expect(has(view(agreement({ status: "draft" })), "Send to customer")).toBe(true);
    expect(has(view(agreement({ status: "draft", shownNo: 1, versions: 2 })), "Send to customer")).toBe(false);
    expect(has(view(agreement({ status: "sent" })), "Send to customer")).toBe(false);
  });

  test("C902: a draft with no lines says to add one before sending", () => {
    expect(text(sendPrompt({ state: { status: "no_lines" } }))).toContain("Add at least one service line before sending.");
  });

  test("C903: a stale send says the agreement was changed by someone else", () => {
    expect(text(sendPrompt({ state: { status: "conflict" } }))).toContain("This agreement was changed by someone else. Reload the page.");
    const reissue = renderToStaticMarkup(createElement(ReissuePrompt, { confirming: false, pending: false, state: { status: "conflict" } }));
    expect(text(reissue)).toContain("This agreement was changed by someone else. Reload the page.");
  });

  test("C904: Get a new link is offered to a writer on the current version of a sent agreement", () => {
    expect(has(view(agreement({ status: "sent" })), "Get a new link")).toBe(true);
    expect(has(view(agreement({ status: "draft" })), "Get a new link")).toBe(false);
    expect(has(view(agreement({ status: "accepted" })), "Get a new link")).toBe(false);
    expect(has(view(agreement({ status: "sent", shownNo: 1, versions: 2 })), "Get a new link")).toBe(false);
    const html = renderToStaticMarkup(createElement(ReissuePrompt, { confirming: true, pending: false, state: idle }));
    expect(text(html)).toContain("The link already given to the customer stops working.");
  });

  test("C905: a sent agreement says when the customer first opened the link, or that it has not been", () => {
    const opened = view(agreement({ status: "sent", portalLink: { firstViewedAt: new Date("2026-10-28T20:00:00Z") } }));
    expect(text(opened)).toContain("Viewed by the customer on Oct 28, 2026");
    expect(text(opened)).not.toContain("Not viewed yet");
    const unopened = view(agreement({ status: "sent", portalLink: { firstViewedAt: null } }));
    expect(text(unopened)).toContain("Not viewed yet");
    expect(text(unopened)).not.toContain("Viewed by the customer");
  });

  test("C905: a draft shows neither line", () => {
    const out = text(view(agreement({ status: "draft" })));
    expect(out).not.toContain("Viewed by the customer");
    expect(out).not.toContain("Not viewed yet");
  });

  test.each(["draft", "sent"] as const)("C906: a viewer sees no Send to customer and no Get a new link on a %s agreement", (status) => {
    const html = view(agreement({ status }), "viewer");
    expect(html).not.toContain("Send to customer");
    expect(html).not.toContain("Get a new link");
  });
});
