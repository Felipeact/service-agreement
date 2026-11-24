import { describe, expect, test, vi } from "vitest";
import type { AgreementTemplateReader, AgreementTemplateStore, AgreementTemplateSummary } from "@/application/ports";
import { SYSTEM_AGREEMENT_BODY } from "@/domain/agreement";
import type { AgreementTemplateBodyV2 } from "@/domain/agreement/template";
import { validateAgreementTemplate } from "@/domain/agreement/template";
import { STARTER_TEMPLATES } from "@/domain/agreement/starter-templates";
import { makeDuplicateAgreementTemplate, makeEnsureStarterTemplates, makeListAgreementTemplates } from "./templates";

const summary = (id: string, name: string, system = false): AgreementTemplateSummary => ({
  id,
  versionId: `${id}-v`,
  versionNo: 1,
  updatedAt: new Date("2026-11-12T12:00:00Z"),
  system,
  body: { ...SYSTEM_AGREEMENT_BODY, name },
});

const reader = (templates: AgreementTemplateSummary[]): AgreementTemplateReader => ({ list: async () => ({ ok: true, templates }) });

describe("the list the Templates screen shows", () => {
  test("C5425: the org's own templates come first and the built-in system template is the last card", async () => {
    const listed = await makeListAgreementTemplates(reader([summary("a", "Annual plan"), summary("s", "Standard agreement", true), summary("q", "Quarterly HVAC")]))();
    expect(listed.ok && listed.templates.map((template) => template.body.name)).toEqual(["Annual plan", "Quarterly HVAC", "Standard agreement"]);
  });

  test("C5425: with none of its own the org sees the system template as the one card", async () => {
    const listed = await makeListAgreementTemplates(reader([summary("s", "Standard agreement", true)]))();
    expect(listed.ok && listed.templates.map((template) => template.body.name)).toEqual(["Standard agreement"]);
  });

  test("C5425: an unreadable list is unavailable, not an empty list", async () => {
    const failing: AgreementTemplateReader = { list: async () => ({ ok: false, code: "unavailable" }) };
    expect(await makeListAgreementTemplates(failing)()).toEqual({ ok: false, code: "unavailable" });
  });
});

describe("a duplicated template", () => {
  const V2: AgreementTemplateBodyV2 = {
    schema: 2,
    name: "Proposal",
    description: "",
    doc: { title: "Maintenance schedule for {{site.name}}", showMeta: false, pageHeader: "every", pageFooter: "letterhead" },
    layout: [
      { kind: "block", type: "heading", text: "Schedule", level: 1 },
      { kind: "section", key: "included", options: { title: "Service included:", showFrequency: true, uppercase: true } },
      { kind: "section", key: "price", options: { visitsFormat: "times_per_year" } },
      { kind: "block", type: "clause", text: "Filters.", indent: 2, pageBreakBefore: true },
    ],
    preset: { termMonths: 12, lines: [] },
  };

  test("C5551: the copy's body has the same layout and document options as the latest version and is named <name> (copy)", async () => {
    const save = vi.fn<AgreementTemplateStore["save"]>(async () => ({ ok: true, templateId: "t-2", versionNo: 1 }));
    const source: AgreementTemplateSummary = { ...summary("t-1", "Proposal"), body: V2 };
    const duplicate = makeDuplicateAgreementTemplate(reader([source]), { save, archive: vi.fn() });
    expect(await duplicate("t-1")).toEqual({ ok: true, templateId: "t-2" });
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith(null, { ...V2, name: "Proposal (copy)" });
  });

  test("C5551: a copy of a name already copied is named (copy 2) and still carries the layout", async () => {
    const save = vi.fn<AgreementTemplateStore["save"]>(async () => ({ ok: true, templateId: "t-3", versionNo: 1 }));
    const duplicate = makeDuplicateAgreementTemplate(reader([{ ...summary("t-1", "Proposal"), body: V2 }, summary("t-2", "Proposal (copy)")]), { save, archive: vi.fn() });
    await duplicate("t-1");
    expect(save).toHaveBeenCalledWith(null, { ...V2, name: "Proposal (copy 2)" });
  });
});

describe("the starter templates", () => {
  test("each one passes the same checks as a template a person saves, with its own name and visit months", () => {
    const names = STARTER_TEMPLATES.map((body) => body.name);
    expect(new Set(names).size).toBe(names.length);
    expect(STARTER_TEMPLATES.length).toBeGreaterThanOrEqual(3);
    for (const body of STARTER_TEMPLATES) {
      expect(validateAgreementTemplate(body).ok, body.name).toBe(true);
      expect(body.preset.lines.every((line) => line.visitMonths.length > 0)).toBe(true);
    }
  });

  test("a company with none of its own is given all of them, once, and then sees them", async () => {
    const store = { save: vi.fn(async () => ({ ok: true as const, templateId: "t", versionNo: 1 })), archive: vi.fn() } as unknown as AgreementTemplateStore;
    let own: AgreementTemplateSummary[] = [];
    const live: AgreementTemplateReader = { list: async () => ({ ok: true, templates: [summary("s", "Standard agreement", true), ...own] }) };
    (store.save as ReturnType<typeof vi.fn>).mockImplementation(async (_id: string | null, body: { name: string }) => {
      own = [...own, summary(`o${own.length}`, body.name)];
      return { ok: true as const, templateId: "t", versionNo: 1 };
    });
    const ensure = makeEnsureStarterTemplates(live, store);

    const first = await ensure();
    expect(first.ok && first.templates.map((template) => template.body.name)).toEqual([...STARTER_TEMPLATES.map((body) => body.name), "Standard agreement"]);
    expect(store.save).toHaveBeenCalledTimes(STARTER_TEMPLATES.length);

    await ensure();
    expect(store.save).toHaveBeenCalledTimes(STARTER_TEMPLATES.length);
  });

  test("a failed save is skipped, and an unreadable list is unavailable and saves nothing", async () => {
    const store = { save: vi.fn(async () => ({ ok: false as const, code: "unavailable" as const })), archive: vi.fn() } as unknown as AgreementTemplateStore;
    const listed = await makeEnsureStarterTemplates(reader([summary("s", "Standard agreement", true)]), store)();
    expect(listed.ok && listed.templates.map((template) => template.body.name)).toEqual(["Standard agreement"]);
    const failing: AgreementTemplateReader = { list: async () => ({ ok: false, code: "unavailable" }) };
    expect(await makeEnsureStarterTemplates(failing, store)()).toEqual({ ok: false, code: "unavailable" });
    expect(store.save).toHaveBeenCalledTimes(STARTER_TEMPLATES.length);
  });
});
