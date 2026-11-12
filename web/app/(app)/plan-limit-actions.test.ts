import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("next/cache", () => ({ refresh: vi.fn(), revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`NEXT_REDIRECT ${to}`);
  },
}));

const SITE = "33333333-3333-4333-8333-333333333333";
const JOB = "66666666-6666-4666-8666-666666666666";

const currentMember = vi.fn();
const create = vi.fn();
const extractImport = vi.fn();
const container = { currentMember, agreementStore: { create }, extractImport };
vi.mock("@/composition", () => ({ getContainer: async () => container }));

const as = (role: string) => currentMember.mockResolvedValue({ status: "member", userId: "u1", email: "u@example.test", orgId: "org-1", orgName: "Org", role });

const AGREEMENTS_REFUSED = { ok: false, code: "plan_limit", plan: "starter", limit: 15, used: 17 };
const IMPORTS_REFUSED = { ok: false, code: "plan_limit", plan: "starter", limit: 10, used: 12, resetsOn: "2026-12-01" };

beforeEach(() => vi.clearAllMocks());

describe("the actions that meet a plan limit", () => {
  test.each([
    ["owner", true],
    ["admin", true],
    ["estimator", false],
  ])("C5112: createAgreementAction for a %s answers the limit message, with the billing link %s", async (role, link) => {
    as(role);
    create.mockResolvedValue(AGREEMENTS_REFUSED);
    const { createAgreementAction } = await import("./agreement-actions");
    const state = await createAgreementAction(SITE);
    expect(state).toMatchObject({ status: "plan_limit" });
    expect(state).toHaveProperty("message", expect.stringContaining("allows 15 live agreements and you have 17"));
    expect(state).toHaveProperty("billingHref", link ? "/settings/billing" : null);
  });

  test.each([
    ["owner", true],
    ["admin", true],
    ["estimator", false],
  ])("C5129: extractImportAction for a %s answers the allowance message, with the billing link %s", async (role, link) => {
    as(role);
    extractImport.mockResolvedValue(IMPORTS_REFUSED);
    const { extractImportAction } = await import("./import-actions");
    const state = await extractImportAction(JOB);
    expect(state).toMatchObject({ status: "plan_limit" });
    expect(state).toHaveProperty("message", expect.stringContaining("allows 10 AI imports a month and you have used 12"));
    expect(state).toHaveProperty("billingHref", link ? "/settings/billing" : null);
  });

  test.each([
    ["owner", true],
    ["estimator", false],
  ])("C5112: startAgreementAction for a %s answers the limit message once the site exists, with the billing link %s", async (role, link) => {
    as(role);
    create.mockResolvedValue(AGREEMENTS_REFUSED);
    const container2 = container as typeof container & Record<string, unknown>;
    container2.siteRegister = vi.fn(async () => ({ customerId: "11111111-1111-4111-8111-111111111111" }));
    container2.customerDetail = vi.fn(async () => ({}));
    const { startAgreementAction } = await import("./new-agreement-actions");
    const state = await startAgreementAction({ customer: "11111111-1111-4111-8111-111111111111", customerName: "", site: SITE, siteName: "", address: "" });
    expect(state).toMatchObject({ status: "plan_limit", billingHref: link ? "/settings/billing" : null });
    expect(state).toHaveProperty("message", expect.stringContaining("you have 17"));
  });
});

describe("Use template: createAgreementAction with a template version", () => {
  const VERSION = "77777777-7777-4777-8777-777777777777";

  test("C5357: the version reaches the store with the site, and an opened agreement redirects", async () => {
    as("estimator");
    create.mockResolvedValue({ ok: true, id: "ag-1" });
    const { createAgreementAction } = await import("./agreement-actions");
    await expect(createAgreementAction(SITE, VERSION)).rejects.toThrow("NEXT_REDIRECT /agreements/ag-1");
    expect(create).toHaveBeenCalledWith(SITE, VERSION);
  });

  test.each([
    ["owner", "/settings/billing"],
    ["estimator", null],
  ])("C5357: a plan-limit refusal for a %s shows the New agreement flow's message and creates nothing else", async (role, link) => {
    as(role);
    create.mockResolvedValue(AGREEMENTS_REFUSED);
    const { createAgreementAction } = await import("./agreement-actions");
    const state = await createAgreementAction(SITE, VERSION);
    expect(state).toMatchObject({ status: "plan_limit", billingHref: link });
    expect(state).toHaveProperty("message", expect.stringContaining("allows 15 live agreements and you have 17"));
  });

  test("C5357: a version the database refuses is invalid_template, and a malformed one never reaches the store", async () => {
    as("estimator");
    create.mockResolvedValue({ ok: false, code: "invalid_template" });
    const { createAgreementAction } = await import("./agreement-actions");
    expect(await createAgreementAction(SITE, VERSION)).toEqual({ status: "invalid_template" });
    create.mockClear();
    expect(await createAgreementAction(SITE, "not-a-uuid")).toEqual({ status: "invalid_template" });
    expect(create).not.toHaveBeenCalled();
  });

  test("C5357: a viewer is forbidden and nothing is created", async () => {
    as("viewer");
    const { createAgreementAction } = await import("./agreement-actions");
    expect(await createAgreementAction(SITE, VERSION)).toEqual({ status: "forbidden" });
    expect(create).not.toHaveBeenCalled();
  });
});
