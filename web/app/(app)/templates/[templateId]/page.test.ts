import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { AgreementTemplateSummary, CurrentMember, MemberRole } from "@/application/ports";
import { SYSTEM_AGREEMENT_BODY } from "@/domain/agreement";

const currentMember = vi.fn<() => Promise<CurrentMember>>();
const listAgreementTemplates = vi.fn();
const listAssetTypes = vi.fn();

vi.mock("@/composition", () => ({ getContainer: async () => ({ currentMember, listAgreementTemplates, listAssetTypes }) }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`NEXT_REDIRECT ${to}`);
  },
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  useRouter: () => ({ refresh: vi.fn() }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { EditTemplateForRequest } = await import("./page");

const OWN = "88888888-8888-4888-8888-888888888888";
const SYSTEM = "00000000-0000-4000-8000-00000000c002";
const OTHER = "99999999-9999-4999-8999-999999999999";
const member = (role: MemberRole): CurrentMember => ({ status: "member", userId: "u1", email: "u@x.test", orgId: "o1", orgName: "Org", role });
const summary = (id: string, patch: Partial<AgreementTemplateSummary> = {}): AgreementTemplateSummary => ({
  id,
  versionId: `${id}-v`,
  versionNo: 4,
  updatedAt: new Date("2026-10-29T12:00:00Z"),
  system: false,
  body: { ...SYSTEM_AGREEMENT_BODY, name: "Quarterly HVAC", description: "Every three months", footer: [{ type: "clause", text: "Thank you." }] },
  ...patch,
});

beforeEach(() => {
  vi.clearAllMocks();
  currentMember.mockResolvedValue(member("owner"));
  listAgreementTemplates.mockResolvedValue({ ok: true, templates: [summary(OWN)] });
  listAssetTypes.mockResolvedValue([]);
});

describe("/templates/[templateId]", () => {
  test("C5354: signed out goes to /login and nothing is read", async () => {
    currentMember.mockResolvedValue({ status: "signed_out" });
    await expect(EditTemplateForRequest({ templateId: OWN })).rejects.toThrow("NEXT_REDIRECT /login");
    expect(listAgreementTemplates).not.toHaveBeenCalled();
  });

  test.each(["estimator", "viewer"] as const)("C5354: a %s goes to /templates, whatever the id, and nothing is read", async (role) => {
    currentMember.mockResolvedValue(member(role));
    await expect(EditTemplateForRequest({ templateId: OWN })).rejects.toThrow("NEXT_REDIRECT /templates");
    await expect(EditTemplateForRequest({ templateId: "nope" })).rejects.toThrow("NEXT_REDIRECT /templates");
    expect(listAgreementTemplates).not.toHaveBeenCalled();
  });

  test.each([
    ["a malformed id", "nope"],
    ["an unknown id", OTHER],
  ])("C5354: %s answers 404", async (_label, templateId) => {
    await expect(EditTemplateForRequest({ templateId })).rejects.toThrow("NEXT_NOT_FOUND");
  });

  test("C5354: the system template and another org's template (not in the member's list) answer 404", async () => {
    listAgreementTemplates.mockResolvedValue({ ok: true, templates: [summary(SYSTEM, { system: true })] });
    await expect(EditTemplateForRequest({ templateId: SYSTEM })).rejects.toThrow("NEXT_NOT_FOUND");
  });

  test.each(["owner", "admin"] as const)("C5349: a %s gets the editor filled with the latest version and told which version saving writes", async (role) => {
    currentMember.mockResolvedValue(member(role));
    const html = renderToStaticMarkup((await EditTemplateForRequest({ templateId: OWN })) as ReactElement);
    expect(html).toContain("Edit template");
    expect(html).toContain("Saving writes version 5.");
    expect(html).toMatch(/id="template-name"[^>]*value="Quarterly HVAC"/);
    expect(html).toContain("- Thank you.");
  });
});
