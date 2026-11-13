import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { CurrentMember, MemberRole } from "@/application/ports";

const currentMember = vi.fn<() => Promise<CurrentMember>>();
const listAgreements = vi.fn();
const listActiveSites = vi.fn();
const listAgreementTemplates = vi.fn();
// 2027-12-02 03:00 UTC is still Dec 1 in Vancouver.
const container = { currentMember, listAgreements, listActiveSites, listAgreementTemplates, clock: { now: () => new Date("2027-12-02T03:00:00Z") } };

const redirect = vi.fn((to: string) => {
  throw new Error(`NEXT_REDIRECT ${to}`);
});

vi.mock("@/composition", () => ({ getContainer: async () => container }));
vi.mock("next/navigation", () => ({ redirect, notFound: vi.fn(), useRouter: () => ({ refresh: vi.fn() }), usePathname: () => "/agreements" }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { AgreementsForRequest } = await import("./agreements/page");
const { NewAgreementLauncher } = await import("./new-agreement-launcher");

const SITE = "00000000-0000-4000-8000-0000000000aa";
const member = (role: MemberRole): CurrentMember => ({ status: "member", userId: "u1", email: "u@x.test", orgId: "o1", orgName: "Org", role });
const render = async (params: Record<string, string | string[] | undefined>) =>
  renderToStaticMarkup((await AgreementsForRequest({ params })) as ReactElement);

beforeEach(() => {
  vi.clearAllMocks();
  currentMember.mockResolvedValue(member("estimator"));
  listAgreements.mockResolvedValue([]);
  listActiveSites.mockResolvedValue([]);
});

describe("/agreements", () => {
  test("C1356: the parsed filter and the Vancouver business day go to the lister, and the view renders", async () => {
    const out = await render({ status: "sent", site: SITE, expiring: "1" });
    expect(listAgreements).toHaveBeenCalledWith({ status: "sent", siteId: SITE, expiring: true }, "2027-12-01");
    expect(out).toContain("Agreements");
    expect(out).toContain("No agreements match");
  });

  test("C1356: an invalid status reads the same rows as no status", async () => {
    await render({ status: "bogus", site: "nope", expiring: "yes" });
    await render({});
    expect(listAgreements).toHaveBeenNthCalledWith(1, {}, "2027-12-01");
    expect(listAgreements).toHaveBeenNthCalledWith(2, {}, "2027-12-01");
  });

  test("C1357: signed out goes to /login and nothing is read", async () => {
    currentMember.mockResolvedValue({ status: "signed_out" });
    await expect(render({})).rejects.toThrow("NEXT_REDIRECT /login");
    expect(listAgreements).not.toHaveBeenCalled();
    expect(listActiveSites).not.toHaveBeenCalled();
  });
});

describe("/agreements, the New agreement launcher", () => {
  test.each([
    ["owner", true],
    ["admin", true],
    ["estimator", true],
    ["viewer", false],
  ] as const)("C5415: for role %s the list gets the New agreement launcher slot: %s", async (role, shown) => {
    currentMember.mockResolvedValue(member(role));
    const view = (await AgreementsForRequest({ params: {} })) as ReactElement<{ newAgreement?: ReactElement }>;
    expect(view.props.newAgreement !== undefined).toBe(shown);
    if (shown) expect(view.props.newAgreement!.type).toBe(NewAgreementLauncher);
  });
});
