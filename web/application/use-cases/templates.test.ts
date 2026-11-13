import { describe, expect, test, vi } from "vitest";
import type { AgreementTemplateReader, AgreementTemplateStore, AgreementTemplateSummary } from "@/application/ports";
import { SYSTEM_AGREEMENT_BODY } from "@/domain/agreement";
import type { AgreementTemplateBodyV2 } from "@/domain/agreement/template";
import { makeDuplicateAgreementTemplate, makeListAgreementTemplates } from "./templates";

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
  test("C5425: when the org has its own templates the list holds only those, and the system template is not a card", async () => {
    const listed = await makeListAgreementTemplates(reader([summary("a", "Annual plan"), summary("s", "Standard agreement", true), summary("q", "Quarterly HVAC")]))();
    expect(listed.ok && listed.templates.map((template) => template.body.name)).toEqual(["Annual plan", "Quarterly HVAC"]);
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
