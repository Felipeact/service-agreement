import { revalidatePath } from "next/cache";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { AgreementTemplateReader, AgreementTemplateStore, AgreementTemplateSummary } from "@/application/ports";
import { makeDuplicateAgreementTemplate } from "@/application/use-cases/templates";
import { SYSTEM_AGREEMENT_BODY } from "@/domain/agreement";
import { EMPTY_TEMPLATE_FORM } from "@/domain/agreement/template-form";

vi.mock("next/cache", () => ({ refresh: vi.fn(), revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`NEXT_REDIRECT ${to}`);
  },
}));

const TEMPLATE = "88888888-8888-4888-8888-888888888888";
const COPY = "99999999-9999-4999-8999-999999999999";

const currentMember = vi.fn();
const saveAgreementTemplate = vi.fn();
const archiveAgreementTemplate = vi.fn();
const duplicateAgreementTemplate = vi.fn();
vi.mock("@/composition", () => ({ getContainer: async () => ({ currentMember, saveAgreementTemplate, archiveAgreementTemplate, duplicateAgreementTemplate }) }));

const as = (role: string) => currentMember.mockResolvedValue({ status: "member", userId: "u1", email: "u@example.test", orgId: "org-1", orgName: "Org", role });
const FORM = { ...EMPTY_TEMPLATE_FORM, name: "Quarterly HVAC", lines: [{ description: "Visit", visitMonths: [3, 6, 9, 12], assetTypeCodes: ["RTU"], costPerVisit: "$450.00" }] };

beforeEach(() => {
  vi.clearAllMocks();
  as("owner");
});

describe("saveAgreementTemplateAction", () => {
  test.each(["estimator", "viewer"])("C5351: a %s is forbidden and no store is called", async (role) => {
    as(role);
    const { saveAgreementTemplateAction } = await import("./template-actions");
    expect(await saveAgreementTemplateAction(null, FORM)).toEqual({ status: "forbidden" });
    expect(saveAgreementTemplate).not.toHaveBeenCalled();
  });

  test("C5351: an invalid body answers the field errors with what was typed and calls no store", async () => {
    const { saveAgreementTemplateAction } = await import("./template-actions");
    const typed = { ...FORM, name: "", termMonths: "61" };
    const state = await saveAgreementTemplateAction(null, typed);
    expect(state).toMatchObject({ status: "invalid", values: typed });
    expect(Object.keys((state as { errors: object }).errors).sort()).toEqual(["name", "preset.termMonths"]);
    expect(saveAgreementTemplate).not.toHaveBeenCalled();
  });

  test("C5351: a valid body calls save once with the validated body and redirects to the list with the template selected", async () => {
    saveAgreementTemplate.mockResolvedValue({ ok: true, templateId: TEMPLATE, versionNo: 2 });
    const { saveAgreementTemplateAction } = await import("./template-actions");
    await expect(saveAgreementTemplateAction(TEMPLATE, FORM)).rejects.toThrow(`NEXT_REDIRECT /templates?selected=${TEMPLATE}`);
    expect(saveAgreementTemplate).toHaveBeenCalledTimes(1);
    expect(saveAgreementTemplate).toHaveBeenCalledWith(TEMPLATE, {
      schema: 1,
      name: "Quarterly HVAC",
      description: "",
      intro: [],
      footer: [],
      sections: { schedule: true, scope: true },
      preset: { termMonths: null, lines: [{ description: "Visit", visitMonths: [3, 6, 9, 12], assetTypeCodes: ["RTU"], costPerVisitCents: 45000 }] },
    });
  });

  test("C5351: a new template is saved with a null id", async () => {
    saveAgreementTemplate.mockResolvedValue({ ok: true, templateId: COPY, versionNo: 1 });
    const { saveAgreementTemplateAction } = await import("./template-actions");
    await expect(saveAgreementTemplateAction(null, FORM)).rejects.toThrow(`/templates?selected=${COPY}`);
    expect(saveAgreementTemplate).toHaveBeenCalledWith(null, expect.objectContaining({ name: "Quarterly HVAC" }));
  });

  test("C5351: a name already taken stays on the editor with the message beside the name, and keeps what was typed", async () => {
    saveAgreementTemplate.mockResolvedValue({ ok: false, code: "name_taken" });
    const { saveAgreementTemplateAction } = await import("./template-actions");
    expect(await saveAgreementTemplateAction(null, FORM)).toEqual({ status: "invalid", errors: { name: expect.stringContaining("name") }, values: FORM });
  });

  test.each([
    ["forbidden", "forbidden"],
    ["not_found", "not_found"],
    ["unavailable", "unavailable"],
    ["invalid", "unavailable"],
  ])("C5351: the store's %s is answered as %s", async (code, expected) => {
    saveAgreementTemplate.mockResolvedValue({ ok: false, code });
    const { saveAgreementTemplateAction } = await import("./template-actions");
    expect(await saveAgreementTemplateAction(TEMPLATE, FORM)).toEqual({ status: expected });
  });

  test("C5351: a malformed template id is not_found and no store is called", async () => {
    const { saveAgreementTemplateAction } = await import("./template-actions");
    expect(await saveAgreementTemplateAction("nope", FORM)).toEqual({ status: "not_found" });
    expect(saveAgreementTemplate).not.toHaveBeenCalled();
  });

  test("C5354: signed out goes to /login", async () => {
    currentMember.mockResolvedValue({ status: "signed_out" });
    const { saveAgreementTemplateAction } = await import("./template-actions");
    await expect(saveAgreementTemplateAction(null, FORM)).rejects.toThrow("NEXT_REDIRECT /login");
  });
});

describe("duplicateTemplateAction", () => {
  test("C5352: the copy is saved by the duplicate use case and the editor of the copy opens", async () => {
    duplicateAgreementTemplate.mockResolvedValue({ ok: true, templateId: COPY });
    const { duplicateTemplateAction } = await import("./template-actions");
    await expect(duplicateTemplateAction(TEMPLATE)).rejects.toThrow(`NEXT_REDIRECT /templates/${COPY}`);
    expect(duplicateAgreementTemplate).toHaveBeenCalledWith(TEMPLATE);
  });

  test.each(["estimator", "viewer"])("C5352: a %s is forbidden and nothing is copied", async (role) => {
    as(role);
    const { duplicateTemplateAction } = await import("./template-actions");
    expect(await duplicateTemplateAction(TEMPLATE)).toEqual({ status: "forbidden" });
    expect(duplicateAgreementTemplate).not.toHaveBeenCalled();
  });

  test("C5352: a failed copy answers its code and opens nothing", async () => {
    duplicateAgreementTemplate.mockResolvedValue({ ok: false, code: "name_taken" });
    const { duplicateTemplateAction } = await import("./template-actions");
    expect(await duplicateTemplateAction(TEMPLATE)).toEqual({ status: "name_taken" });
  });
});

describe("archiveTemplateAction", () => {
  test("C5353: confirming calls archive once for that template and answers archived", async () => {
    archiveAgreementTemplate.mockResolvedValue({ ok: true });
    const { archiveTemplateAction } = await import("./template-actions");
    expect(await archiveTemplateAction(TEMPLATE)).toEqual({ status: "archived" });
    expect(archiveAgreementTemplate).toHaveBeenCalledTimes(1);
    expect(archiveAgreementTemplate).toHaveBeenCalledWith(TEMPLATE);
    // The list is read again, so the card leaves it.
    expect(revalidatePath).toHaveBeenCalledWith("/templates");
  });

  test.each(["estimator", "viewer"])("C5353: a %s is forbidden and nothing is archived", async (role) => {
    as(role);
    const { archiveTemplateAction } = await import("./template-actions");
    expect(await archiveTemplateAction(TEMPLATE)).toEqual({ status: "forbidden" });
    expect(archiveAgreementTemplate).not.toHaveBeenCalled();
  });

  test("C5353: a refusal of the store is answered, and a malformed id never reaches it", async () => {
    archiveAgreementTemplate.mockResolvedValue({ ok: false, code: "not_found" });
    const { archiveTemplateAction } = await import("./template-actions");
    expect(await archiveTemplateAction(TEMPLATE)).toEqual({ status: "not_found" });
    archiveAgreementTemplate.mockClear();
    expect(await archiveTemplateAction("nope")).toEqual({ status: "not_found" });
    expect(archiveAgreementTemplate).not.toHaveBeenCalled();
  });
});

describe("customizeSystemTemplateAction", () => {
  const SYSTEM = "00000000-0000-4000-8000-00000000c002";
  // A queued implementation that a refused call never used must not reach the next test.
  beforeEach(() => duplicateAgreementTemplate.mockReset());
  const summary = (id: string, name: string, system: boolean): AgreementTemplateSummary => ({
    id,
    versionId: `${id}-v`,
    versionNo: 1,
    updatedAt: new Date("2026-11-12T12:00:00Z"),
    system,
    body: { ...SYSTEM_AGREEMENT_BODY, name },
  });

  /** The real duplicate use case over a reader holding `templates`, and a store that records what it is asked to save. */
  function useCaseOver(templates: AgreementTemplateSummary[]) {
    const reader: AgreementTemplateReader = { list: async () => ({ ok: true, templates }) };
    const save = vi.fn<AgreementTemplateStore["save"]>(async () => ({ ok: true, templateId: COPY, versionNo: 1 }));
    duplicateAgreementTemplate.mockImplementationOnce(makeDuplicateAgreementTemplate(reader, { save, archive: vi.fn() }));
    return save;
  }

  test.each(["owner", "admin"])("C5420: a %s saves a copy of the system template named Standard agreement and is sent to the editor of the copy", async (role) => {
    as(role);
    const save = useCaseOver([summary(SYSTEM, "Standard agreement", true)]);
    const { customizeSystemTemplateAction } = await import("./template-actions");
    await expect(customizeSystemTemplateAction(SYSTEM)).rejects.toThrow(`NEXT_REDIRECT /templates/${COPY}`);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith(null, expect.objectContaining({ name: "Standard agreement" }));
  });

  test("C5420: when Standard agreement is taken the copy is Standard agreement (copy), then (copy 2)", async () => {
    const { customizeSystemTemplateAction } = await import("./template-actions");
    const system = summary(SYSTEM, "Standard agreement", true);

    let save = useCaseOver([system, summary("t-own", "Standard agreement", false)]);
    await expect(customizeSystemTemplateAction(SYSTEM)).rejects.toThrow(`NEXT_REDIRECT /templates/${COPY}`);
    expect(save).toHaveBeenCalledWith(null, expect.objectContaining({ name: "Standard agreement (copy)" }));

    save = useCaseOver([system, summary("t-own", "Standard agreement", false), summary("t-copy", "standard agreement (copy)", false)]);
    await expect(customizeSystemTemplateAction(SYSTEM)).rejects.toThrow(`NEXT_REDIRECT /templates/${COPY}`);
    expect(save).toHaveBeenCalledWith(null, expect.objectContaining({ name: "Standard agreement (copy 2)" }));
  });

  test("C5420: the copy carries the system body (sections, intro, preset) and only the name is decided here", async () => {
    const save = useCaseOver([summary(SYSTEM, "Standard agreement", true)]);
    const { customizeSystemTemplateAction } = await import("./template-actions");
    await expect(customizeSystemTemplateAction(SYSTEM)).rejects.toThrow("NEXT_REDIRECT");
    expect(save.mock.calls[0][1]).toEqual({ ...SYSTEM_AGREEMENT_BODY, name: "Standard agreement" });
  });

  test.each(["estimator", "viewer"])("C5420: a %s is forbidden and nothing is saved", async (role) => {
    as(role);
    const save = useCaseOver([summary(SYSTEM, "Standard agreement", true)]);
    const { customizeSystemTemplateAction } = await import("./template-actions");
    expect(await customizeSystemTemplateAction(SYSTEM)).toEqual({ status: "forbidden" });
    expect(save).not.toHaveBeenCalled();
    expect(duplicateAgreementTemplate).not.toHaveBeenCalled();
  });

  test("C5420: an org template is never saved under its own name: customizing it falls back to the copy naming", async () => {
    const save = useCaseOver([summary(SYSTEM, "Standard agreement", true), summary(TEMPLATE, "Quarterly HVAC", false)]);
    const { customizeSystemTemplateAction } = await import("./template-actions");
    await expect(customizeSystemTemplateAction(TEMPLATE)).rejects.toThrow(`NEXT_REDIRECT /templates/${COPY}`);
    expect(save).toHaveBeenCalledWith(null, expect.objectContaining({ name: "Quarterly HVAC (copy)" }));
  });

  test("C5420: a malformed id is not_found, a failed copy answers its code, and signed out goes to /login", async () => {
    const { customizeSystemTemplateAction } = await import("./template-actions");
    expect(await customizeSystemTemplateAction("nope")).toEqual({ status: "not_found" });
    expect(duplicateAgreementTemplate).not.toHaveBeenCalled();
    duplicateAgreementTemplate.mockResolvedValueOnce({ ok: false, code: "unavailable" });
    expect(await customizeSystemTemplateAction(SYSTEM)).toEqual({ status: "unavailable" });
    currentMember.mockResolvedValue({ status: "signed_out" });
    await expect(customizeSystemTemplateAction(SYSTEM)).rejects.toThrow("NEXT_REDIRECT /login");
  });
});
