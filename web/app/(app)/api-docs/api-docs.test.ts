import { beforeEach, describe, expect, test, vi } from "vitest";
import type { CurrentMember } from "@/application/ports";

const currentMember = vi.fn<() => Promise<CurrentMember>>();
const memberPlan = vi.fn(async () => "team" as string | null);
const redirect = vi.fn((to: string) => {
  throw new Error(`redirect:${to}`);
});

vi.mock("@/composition", async () => {
  const access = await import("@/domain/billing/plan-access");
  const api = await import("@/domain/public-api");
  return { getContainer: async () => ({ currentMember, memberPlan }), planAllows: access.planAllows, openApiDocument: api.openApiDocument };
});
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ host: "app.test", "x-forwarded-proto": "https" }) }));

const { loadApiDocs } = await import("./_data-access/api-docs");

const as = (role: "owner" | "admin" | "estimator" | "viewer") => currentMember.mockResolvedValue({ status: "member", userId: "u1", email: "o@example.com", orgId: "org-1", orgName: "Org", role });

beforeEach(() => {
  vi.clearAllMocks();
  memberPlan.mockResolvedValue("team");
});

describe("the API reference page", () => {
  test("an owner on Team gets the document", async () => {
    as("owner");
    const { spec, plan } = await loadApiDocs();
    expect(plan).toBe("team");
    expect((spec as { openapi: string }).openapi).toBe("3.1.0");
    expect((spec as { servers: { url: string }[] }).servers[0].url).toBe("https://app.test/api/v1");
  });

  test("signed out goes to sign-in", async () => {
    currentMember.mockResolvedValue({ status: "signed_out" } as CurrentMember);
    await expect(loadApiDocs()).rejects.toThrow("redirect:/login");
  });

  test.each(["estimator", "viewer"] as const)("a %s goes back to the Pipeline", async (role) => {
    as(role);
    await expect(loadApiDocs()).rejects.toThrow("redirect:/pipeline");
  });

  test("a Starter company, no plan, or a failed read goes back to the Pipeline", async () => {
    as("owner");
    for (const plan of ["starter", null]) {
      memberPlan.mockResolvedValue(plan);
      await expect(loadApiDocs()).rejects.toThrow("redirect:/pipeline");
    }
    memberPlan.mockRejectedValue(new Error("down"));
    await expect(loadApiDocs()).rejects.toThrow("redirect:/pipeline");
  });
});
