import { describe, expect, test } from "vitest";
import type { AgreementTemplateReader, AgreementTemplateSummary } from "@/application/ports";
import { SYSTEM_AGREEMENT_BODY } from "@/domain/agreement";
import { makeListAgreementTemplates } from "./templates";

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
