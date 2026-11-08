import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import type { AgreementDetail, AgreementServiceScope, MemberRole, ServiceLineView } from "@/application/ports";
import type { AgreementStatus, EquipmentChoice } from "@/domain/agreement";
import type { ContractStatus } from "@/domain/contract";
import { itemWords } from "@/domain/org-settings";
import { pipelineStage } from "@/domain/pipeline";
import { AgreementView, type AgreementActions } from "./agreement-view";
import { LineForm } from "./line-form";
import { RemovePrompt } from "./line-row";
import { GenerateContractControl, GenerateContractPrompt } from "./contract-controls";
import { CONTRACT_MESSAGES } from "./contract-state";
import { LinkPanel, ReissuePrompt, SendPrompt } from "./link-controls";
import { RevisePrompt, WithdrawPrompt } from "./move-controls";
import { VersionCompare } from "./version-compare";
import type { LineState, MoveState } from "./state";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }), usePathname: () => "/agreements" }));

const STATUSES: AgreementStatus[] = ["draft", "sent", "accepted", "refused", "changes_requested", "expired", "withdrawn"];

/** The site's equipment a line can cover (cadence AC 8). */
const CHOICES: EquipmentChoice[] = [
  { id: "t-ahu", code: "AHU", name: "Air handling unit", defaultVisitMonths: [3, 6, 9, 12] },
  { id: "t-rtu", code: "RTU", name: "Rooftop unit", defaultVisitMonths: [3, 6, 9, 12] },
];

const LINES: ServiceLineView[] = [
  { id: "l1", position: 0, description: "Preventive maintenance visit", visitsPerYear: 4, costPerVisitCents: 89250, annualCents: 357000, visitMonths: [3, 6, 9, 12], equipment: [{ id: "t-rtu", code: "RTU", name: "Rooftop unit" }] },
  { id: "l2", position: 1, description: "Filter changes", visitsPerYear: 2, costPerVisitCents: 15000, annualCents: 30000, visitMonths: [4, 10], equipment: [{ id: "t-rtu", code: "RTU", name: "Rooftop unit" }] },
];

function agreement(
  over: { status?: AgreementStatus; lines?: ServiceLineView[]; shownNo?: number; versions?: number; serviceScope?: AgreementServiceScope; portalLink?: AgreementDetail["portalLink"]; linkEmail?: AgreementDetail["linkEmail"]; equipmentChoices?: EquipmentChoice[]; validUntil?: string | null; detail?: Partial<AgreementDetail> } = {},
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
    versions: Array.from({ length: count }, (_, i) => ({ versionNo: count - i, createdAt: new Date(Date.UTC(2026, 9, 20 + count - i, 18)), reason: null, author: null, events: [] })),
    sentVersion: null,
    acceptedVersion: null,
    compare: null,
    shown: { versionNo: shownNo, current: shownNo === count, lines, annualCents: lines.reduce((t, l) => t + l.annualCents, 0) },
    editable: status === "draft" && shownNo === count,
    equipmentChoices: over.equipmentChoices ?? CHOICES,
    serviceScope: over.serviceScope ?? { source: "live", takenAt: null, types: [] },
    terms: null,
    validUntil: over.validUntil ?? null,
    portalLink: over.portalLink ?? null,
    linkEmail: over.linkEmail ?? null,
    renews: null,
    renewedBy: null,
    term: { start: null, months: 12, end: null },
    ...over.detail,
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
  saveTerm: async () => ({ status: "idle" as const }),
  saveNote: async () => ({ status: "idle" as const }),
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
    const months = writer.match(/<input[^>]*name="visitMonths"[^>]*>/g) ?? [];
    expect(months).toHaveLength(12);
    for (const box of months) expect(box).not.toContain("checked");
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
        initial: { description: "", visitMonths: [], costPerVisit: "", assetTypeIds: [] },
        state,
        pending: false,
        submitLabel: "Add line",
      }),
    );

  test("C721: a cost message sits under the cost field, linked by aria-describedby", () => {
    const html = form({
      status: "invalid",
      errors: { costPerVisit: "Enter a cost per visit from $0 to $999,999.99" },
      values: { description: "PM", visitMonths: ["3", "6", "9", "12"], costPerVisit: "abc", assetTypeIds: ["t-rtu"] },
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
    tasks: [
      { description: "Replace filters", visitMonths: null },
      { description: "Check belts", visitMonths: null },
    ],
    assets: [
      { unitNo: "RTU-1", typeModel: "Carrier 48TC", location: "Roof" },
      { unitNo: "RTU-2", typeModel: null, location: null },
    ],
  };
  const BOILER = { code: "BOILER", name: "Boiler", tasks: [{ description: "Flow switch test", visitMonths: null }], assets: [{ unitNo: "B-1", typeModel: "Condensing", location: "P1" }] };
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

  test("C1235: a sent agreement shows its validity date, formatted from the text", () => {
    expect(text(view(agreement({ status: "sent", validUntil: "2026-12-02" })))).toContain("Valid until Dec 2, 2026");
    const jan = text(view(agreement({ status: "sent", validUntil: "2027-01-01" })));
    expect(jan).toContain("Valid until Jan 1, 2027");
    expect(jan).not.toContain("Dec 31, 2026");
  });

  test("C1235: an expired agreement says it expired, and offers neither Withdraw nor Get a new link", () => {
    const out = view(agreement({ status: "expired", validUntil: "2026-12-02" }));
    expect(text(out)).toContain("Expired · was valid until Dec 2, 2026");
    expect(has(out, "Withdraw")).toBe(false);
    expect(has(out, "Get a new link")).toBe(false);
  });

  test("C1235: a sent agreement with no date shows no validity line", () => {
    expect(text(view(agreement({ status: "sent", validUntil: null })))).not.toContain("Valid until");
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

  test("C1032: a sent agreement says who the link was emailed to and when", () => {
    const out = text(view(agreement({ status: "sent", linkEmail: { status: "sent", to: "pat@customer.ca", sentAt: new Date("2026-10-29T18:00:00Z") } })));
    expect(out).toContain("Emailed to pat@customer.ca on Oct 29, 2026");
    expect(out).not.toContain("Not emailed");
    expect(out).not.toContain("Email pending");
  });

  test("C1032: each reason it was not emailed has its own words, with no underscore", () => {
    const lines = (["no_recipient", "no_link_secret", "reserved_domain", "failed"] as const).map((reason) => {
      const html = view(agreement({ status: "sent", linkEmail: { status: "not_sent", reason } }));
      const out = text(html);
      const line = /Not emailed: [^<]*/.exec(html)?.[0] ?? "";
      expect(line.length).toBeGreaterThan("Not emailed: ".length);
      expect(line).not.toContain("_");
      expect(out).not.toContain("Emailed to");
      return line;
    });
    expect(new Set(lines).size).toBe(4);
  });

  test("C1032: with no notification the line reads Email pending", () => {
    expect(text(view(agreement({ status: "sent", linkEmail: { status: "pending" } })))).toContain("Email pending");
    expect(text(view(agreement({ status: "sent", linkEmail: null })))).toContain("Email pending");
  });

  test("C1032: a draft shows none of the three", () => {
    const out = text(view(agreement({ status: "draft", linkEmail: { status: "sent", to: "pat@customer.ca", sentAt: new Date("2026-10-29T18:00:00Z") } })));
    for (const phrase of ["Emailed to", "Not emailed", "Email pending"]) expect(out).not.toContain(phrase);
  });
});

describe("AgreementView: renewal links", () => {
  const render = (patch: Partial<AgreementDetail>) =>
    renderToStaticMarkup(createElement(AgreementView, { agreement: { ...agreement({ status: "accepted" }), ...patch }, role: "owner" }));

  test("C1205: renews reads 'Renewal of AG-1004' and links to it", () => {
    const html = render({ renews: { id: "old-id", number: "AG-1004" } });
    expect(html).toMatch(/<a[^>]*href="\/agreements\/old-id"[^>]*>Renewal of <!-- -->AG-1004<\/a>|<a[^>]*href="\/agreements\/old-id"[^>]*>Renewal of AG-1004<\/a>/);
  });

  test("C1205: renewedBy reads 'Renewed by AG-1013' and links to it", () => {
    const html = render({ renewedBy: { id: "new-id", number: "AG-1013" } });
    expect(html).toMatch(/<a[^>]*href="\/agreements\/new-id"[^>]*>Renewed by <!-- -->AG-1013<\/a>|<a[^>]*href="\/agreements\/new-id"[^>]*>Renewed by AG-1013<\/a>/);
  });

  test("C1205: neither text shows when both are null", () => {
    const html = render({ renews: null, renewedBy: null });
    expect(html).not.toContain("Renewal of");
    expect(html).not.toContain("Renewed by");
  });
});

describe("the versions history and the comparison", () => {
  const at = (day: number) => new Date(Date.UTC(2026, 9, day, 18));
  const version = (versionNo: number, over: Partial<AgreementDetail["versions"][number]> = {}) => ({
    versionNo,
    createdAt: at(20 + versionNo),
    reason: null,
    author: null,
    events: [],
    ...over,
  });
  /** One `<li data-version>` block, cut at the next version so nested history items do not end it early. */
  const block = (html: string, no: number) => html.split(/(?=<li[^>]*data-version=)/).find((part) => part.startsWith(`<li`) && part.includes(`data-version="${no}"`)) ?? "";

  test("C1323: a reason renders next to its version, and no reason renders no reason element or placeholder", () => {
    const html = view(agreement({ detail: { versions: [version(2, { reason: "Too expensive", author: "estimator" }), version(1)] } }));
    expect(block(html, 2)).toContain("Too expensive");
    expect(block(html, 2)).toContain("estimator");
    expect(block(html, 1)).not.toContain("data-reason");
    expect(block(html, 1)).not.toMatch(/No reason|reason:|n\/a/i);
  });

  test("C1330: Sent and Accepted mark the versions the events name, and no other", () => {
    const html = view(agreement({ versions: 3, detail: { sentVersion: 1, acceptedVersion: 2 } }));
    expect(block(html, 1)).toContain(">Sent<");
    expect(block(html, 1)).not.toContain(">Accepted<");
    expect(block(html, 2)).toContain(">Accepted<");
    expect(block(html, 2)).not.toContain(">Sent<");
    expect(block(html, 3)).not.toMatch(/>Sent<|>Accepted</);
  });

  test("C1331: a version without events says Not sent yet, and one with events does not", () => {
    const html = view(
      agreement({ detail: { versions: [version(2), version(1, { events: [{ type: "sent", at: at(21), by: "estimator" }, { type: "viewed", at: at(22), by: "customer" }] })] } }),
    );
    expect(block(html, 2)).toContain("Not sent yet");
    expect(block(html, 1)).not.toContain("Not sent yet");
    const history = text(block(html, 1));
    expect(history).toMatch(/Sent .*estimator/);
    expect(history).toMatch(/Viewed .*customer/);
  });

  test("C1337: identical versions say No differences", () => {
    const html = view(agreement({ versions: 2, detail: { compare: { versionNo: 1, lines: LINES, annualCents: 387000 } } }));
    expect(text(html)).toContain("No differences");
  });

  test("C1339: changed, removed and added lines show their values, and both totals show the signed change", () => {
    const shown = [
      { ...LINES[0]!, costPerVisitCents: 95000, annualCents: 380000 },
      { id: "l3", position: 2, description: "Boiler checks", visitsPerYear: 1, costPerVisitCents: 20000, annualCents: 20000, visitMonths: [10], equipment: [{ id: "t-ahu", code: "AHU", name: "Air handling unit" }] },
    ];
    const html = view(agreement({ versions: 2, lines: shown, detail: { compare: { versionNo: 1, lines: LINES, annualCents: 387000 } } }));
    const out = text(html);
    expect(out).toContain("Changes from version 1 to version 2");
    expect(out).toMatch(/Preventive maintenance visit.*Per visit.*\$892\.50.*\$950\.00/);
    expect(out).toMatch(/Removed.*Filter changes.*\$150\.00/);
    expect(out).toMatch(/Added.*Boiler checks.*\$200\.00/);
    expect(out).toContain("$3,870.00");
    expect(out).toContain("$4,000.00");
    expect(out).toContain("+$130.00");
    expect(out).not.toContain("No differences");
  });

  test("C1339: a smaller total shows a minus sign", () => {
    const html = view(agreement({ versions: 2, lines: [LINES[0]!], detail: { compare: { versionNo: 1, lines: LINES, annualCents: 387000 } } }));
    expect(text(html)).toContain("−$300.00");
  });

  test("C1340: the history and the comparison still render for a withdrawn agreement, with no write control", () => {
    const html = view(
      agreement({ status: "withdrawn", versions: 2, detail: { sentVersion: 1, compare: { versionNo: 1, lines: LINES, annualCents: 387000 } } }),
      "estimator",
    );
    expect(text(html)).toContain("No differences");
    expect(block(html, 1)).toContain(">Sent<");
    for (const label of ["Add line", "Edit", "Remove", "Send to customer", "Save term"]) expect(has(html, label), label).toBe(false);
  });

  test("every version but the shown one links to the comparison with the shown version, and no form is rendered", () => {
    const html = view(agreement({ versions: 3, shownNo: 3 }), "viewer");
    expect(html).toContain('href="/agreements/g1?version=3&amp;compare=2"');
    expect(html).toContain('href="/agreements/g1?version=3&amp;compare=1"');
    expect(html).not.toContain('href="/agreements/g1?version=3&amp;compare=3"');
    expect(html).not.toContain("<form");
  });
});

describe("the activity timeline", () => {
  const entry = (over: Partial<NonNullable<AgreementDetail["timeline"]>[number]>): NonNullable<AgreementDetail["timeline"]>[number] => ({
    type: "sent",
    label: "Sent to customer",
    at: new Date(Date.UTC(2026, 9, 21, 17, 30)),
    versionNo: 1,
    by: "estimator",
    reason: null,
    detail: null,
    ...over,
  });
  const section = (html: string) => html.split(/(?=<section)/).find((part) => part.includes('aria-label="Activity"')) ?? "";
  const CREATED = entry({ type: "created", label: "Created", at: new Date(Date.UTC(2026, 9, 20, 16, 0)), by: "owner" });

  test("C1484: entries read newest first, each with its label, version and Vancouver time", () => {
    const timeline = [
      entry({ type: "accepted", label: "Accepted", at: new Date(Date.UTC(2026, 9, 25, 20, 5)), versionNo: 2, by: "customer" }),
      entry({}),
      CREATED,
    ];
    const out = text(section(view(agreement({ detail: { timeline } }))));
    expect(out.indexOf("Accepted")).toBeGreaterThan(-1);
    expect(out.indexOf("Accepted")).toBeLessThan(out.indexOf("Sent to customer"));
    expect(out.indexOf("Sent to customer")).toBeLessThan(out.indexOf("Created"));
    expect(out).toContain("Version 2");
    expect(out).toContain("Oct 21, 2026");
    expect(out).toMatch(/10:30\s?a\.m\./);
    expect(out).toMatch(/Oct 25, 2026.*1:05\s?p\.m\./);
    expect(out).toContain("customer");
  });

  test("C1487: a reason renders in full, wrapped, and an entry without one renders no reason element", () => {
    const long = "Too expensive. ".repeat(27).trim();
    expect(long.length).toBeGreaterThan(400);
    const timeline = [entry({ type: "refused", label: "Refused", by: "customer", reason: long }), entry({}), CREATED];
    const html = section(view(agreement({ detail: { timeline } })));
    expect(text(html)).toContain(long);
    expect(html).toMatch(/data-reason[^>]*class="[^"]*break-words|class="[^"]*break-words[^"]*"[^>]*data-reason/);
    expect(html.match(/data-reason/g)).toHaveLength(1);
  });

  test("C1490: an agreement with only Created still shows the Activity section with that entry", () => {
    const out = text(section(view(agreement({ versions: 1, detail: { timeline: [CREATED] } }))));
    expect(out).toContain("Activity");
    expect(out).toContain("Created");
    expect(out).toContain("owner");
  });

  test("C1492: a withdrawn agreement renders its Activity entries and no write control", () => {
    const timeline = [entry({ type: "withdrawn", label: "Withdrawn · site deactivated", by: "owner" }), entry({}), CREATED];
    const html = view(agreement({ status: "withdrawn", detail: { timeline } }), "estimator");
    expect(text(section(html))).toContain("Withdrawn · site deactivated");
    for (const label of ["Add line", "Edit", "Remove", "Send to customer", "Save term"]) expect(has(html, label), label).toBe(false);
  });
});

describe("the generate contract control", () => {
  const SIGNER = { name: "Pat Lee", email: "pat@example.com" };
  const TERM = { start: "2027-01-01", months: 12, end: "2027-12-31" };
  const accepted = (detail: Partial<AgreementDetail> = {}) =>
    agreement({ status: "accepted", lines: [{ ...LINES[0], annualCents: 180000 }], detail: { contract: null, signer: SIGNER, term: TERM, ...detail } });
  const generateActions: AgreementActions = { ...actions, generate: async () => ({ status: "idle" }) };
  const page = (a: AgreementDetail, role: MemberRole = "estimator") => renderToStaticMarkup(createElement(AgreementView, { agreement: a, role, actions: generateActions }));

  test.each<MemberRole>(["owner", "admin", "estimator"])("C1623: a %s sees Generate contract on an accepted agreement with no contract", (role) => {
    expect(has(page(accepted(), role), "Generate contract")).toBe(true);
  });

  test("C1623: a viewer sees none", () => {
    expect(has(page(accepted(), "viewer"), "Generate contract")).toBe(false);
  });

  test("C1623: an accepted agreement with a contract shows none", () => {
    expect(has(page(accepted({ contract: { id: "con-1", status: "pending_signature" } })), "Generate contract")).toBe(false);
  });

  test.each<AgreementStatus>(["draft", "sent", "refused", "changes_requested", "expired", "withdrawn"])("C1623: a %s agreement shows none", (status) => {
    expect(has(page(agreement({ status, detail: { contract: null, signer: SIGNER } })), "Generate contract")).toBe(false);
  });

  test.each<[ContractStatus, string]>([
    ["pending_signature", "Pending signature"],
    ["client_signed", "Client signed"],
    ["completed", "Completed"],
    ["declined", "Declined"],
    ["voided", "Voided"],
  ])("C1624: a contract that is %s reads %s, links to /contracts/con-1 and replaces the button, for every role", (status, label) => {
    for (const role of ["owner", "admin", "estimator", "viewer"] as const) {
      const html = page(accepted({ contract: { id: "con-1", status } }), role);
      expect(text(html), role).toContain(`Contract: ${label}`);
      expect(html, role).toMatch(/<a[^>]*href="\/contracts\/con-1"[^>]*>/);
      expect(has(html, "Generate contract"), role).toBe(false);
    }
  });

  const prompt = (over: Partial<Parameters<typeof GenerateContractPrompt>[0]> = {}) =>
    renderToStaticMarkup(
      createElement(GenerateContractPrompt, { signer: SIGNER, term: TERM, annualCents: 180000, confirming: false, pending: false, state: { status: "idle" }, ...over }),
    );

  test("C1625: not confirming, it renders one Generate contract button, no form and no submit button", () => {
    const html = prompt();
    expect(has(html, "Generate contract")).toBe(true);
    expect(html.match(/<button/g)).toHaveLength(1);
    expect(html).not.toContain("<form");
    expect(html).not.toContain('type="submit"');
  });

  test("C1625: confirming, it names the signer, the term and the total, with a submit button and Cancel", () => {
    const html = prompt({ confirming: true });
    const out = text(html);
    expect(out).toContain("Pat Lee · pat@example.com");
    expect(out).toContain("Jan 1, 2027 – Dec 31, 2027 · 12 months");
    expect(out).toContain("Total per year $1,800.00");
    expect(html).toMatch(/<button[^>]*type="submit"[^>]*>Generate contract<\/button>/);
    expect(has(html, "Cancel")).toBe(true);
  });

  test("C1625: with no signer it says so in place of the signer", () => {
    const out = text(prompt({ confirming: true, signer: null }));
    expect(out).toContain("No signer with an email yet.");
    expect(out).not.toContain("Pat Lee");
  });

  test("C1625: the stateful control renders the not-confirming markup first", () => {
    const html = renderToStaticMarkup(createElement(GenerateContractControl, { signer: SIGNER, term: TERM, annualCents: 180000, action: async () => ({ status: "idle" as const }) }));
    expect(has(html, "Generate contract")).toBe(true);
    expect(html).not.toContain("<form");
  });

  test.each(["not_accepted", "auto_renewal", "site_inactive", "no_term_start", "no_signer"] as const)("C1626: %s renders its message in an alert, confirming or not", (status) => {
    for (const confirming of [false, true]) {
      const html = prompt({ confirming, state: { status } });
      expect(html).toMatch(new RegExp(`<p[^>]*role="alert"[^>]*>${CONTRACT_MESSAGES[status].replace(/'/g, "&#x27;")}</p>`));
    }
  });

  test("C1626: idle renders no alert", () => {
    expect(prompt({ confirming: true })).not.toContain('role="alert"');
  });
});

describe("the agreement builder, item words", () => {
  const stations = itemWords("station", "stations");
  const noEquipment = (html: string) => expect(html).not.toMatch(/equipment/i);
  const render = (a: AgreementDetail, role: MemberRole = "estimator") =>
    renderToStaticMarkup(createElement(AgreementView, { agreement: a, role, actions, words: stations }));

  test("C2015: the covered legend, the type message and the no-choices line use the org's words", () => {
    const form = renderToStaticMarkup(
      createElement(LineForm, {
        idPrefix: "x", initial: { description: "", visitMonths: [], costPerVisit: "", assetTypeIds: [] }, submitLabel: "Add line", pending: false,
        state: { status: "invalid", errors: { assetTypeIds: "Choose at least one equipment type" }, values: { description: "", visitMonths: [], costPerVisit: "", assetTypeIds: [] } },
        choices: CHOICES, words: stations,
      }),
    );
    expect(form).toContain("Stations covered");
    expect(form).toContain("Choose at least one station type");
    noEquipment(form);
    const none = render(agreement({ equipmentChoices: [] }));
    expect(none).toContain("Add stations to this site before adding a service line");
    noEquipment(none);
  });

  test("C2016: the panel heading and its empty lines use the org's words", () => {
    const live = render(agreement({ status: "sent", serviceScope: { source: "live", takenAt: null, types: [] } }));
    expect(live).toContain("<h2");
    expect(live).toMatch(/<h2[^>]*>Stations<\/h2>/);
    expect(live).toContain("No stations on this site yet.");
    expect(live).toContain("Add stations");
    noEquipment(live);
    const frozen = render(agreement({ status: "sent", serviceScope: { source: "frozen", takenAt: new Date("2026-10-20T15:00:00Z"), types: [] } }));
    expect(frozen).toContain("No stations were recorded for this version.");
    noEquipment(frozen);
  });

  test("C2016: the comparison names the changed field with the org's plural", () => {
    const [first] = LINES;
    const changed = { ...first, equipment: [{ id: "t-blr", code: "BLR", name: "Boiler" }] };
    const html = renderToStaticMarkup(createElement(VersionCompare, { fromNo: 1, toNo: 2, from: [first], to: [changed], words: stations }));
    expect(html).toMatch(/Stations(<!-- -->)?: /);
    noEquipment(html);
  });
});
