import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { CurrentMember, MemberRole } from "@/application/ports";

const currentMember = vi.fn<() => Promise<CurrentMember>>();
const listAgreements = vi.fn();
const listActiveSites = vi.fn();
// 2027-12-02 03:00 UTC is still Dec 1 in Vancouver.
const container = { currentMember, listAgreements, listActiveSites, clock: { now: () => new Date("2027-12-02T03:00:00Z") } };

const redirect = vi.fn((to: string) => {
  throw new Error(`NEXT_REDIRECT ${to}`);
});

vi.mock("@/composition", () => ({ getContainer: async () => container }));
vi.mock("next/navigation", () => ({ redirect, notFound: vi.fn(), useRouter: () => ({ refresh: vi.fn() }), usePathname: () => "/agreements" }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { AgreementsForRequest } = await import("./agreements/page");
const { default: NewAgreementPage } = await import("./agreements/new/page");

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
    await expect(NewAgreementPage()).rejects.toThrow("NEXT_REDIRECT /login");
    expect(listAgreements).not.toHaveBeenCalled();
    expect(listActiveSites).not.toHaveBeenCalled();
  });
});

describe("/agreements/new", () => {
  test("C1363: a viewer gets a forbidden panel, no form and no site read", async () => {
    currentMember.mockResolvedValue(member("viewer"));
    const out = renderToStaticMarkup((await NewAgreementPage()) as ReactElement);
    expect(out).toContain("don&#x27;t have permission to create agreements");
    expect(out).not.toContain("<form");
    expect(listActiveSites).not.toHaveBeenCalled();
  });

  test("C1363: a writer gets the site picker", async () => {
    listActiveSites.mockResolvedValue([{ id: SITE, name: "Tower A", customer: "Harbourview", liveAgreement: null }]);
    const out = renderToStaticMarkup((await NewAgreementPage()) as ReactElement);
    expect(out).toContain("<form");
    expect(out).toContain("Tower A");
  });
});
