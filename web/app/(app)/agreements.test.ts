import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { AgreementDetail, CurrentMember, MemberRole, SiteView } from "@/application/ports";

const currentMember = vi.fn<() => Promise<CurrentMember>>();
const container = {
  currentMember,
  siteRegister: vi.fn(),
  agreementReader: { get: vi.fn() },
  agreementStore: { create: vi.fn() },
  serviceLineStore: { add: vi.fn(), update: vi.fn(), remove: vi.fn() },
  transitionAgreement: vi.fn(),
};
const WRITES = [
  container.agreementStore.create,
  container.serviceLineStore.add,
  container.serviceLineStore.update,
  container.serviceLineStore.remove,
  container.transitionAgreement,
];

const notFound = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});
const redirect = vi.fn((to: string) => {
  throw new Error(`NEXT_REDIRECT ${to}`);
});
const revalidatePath = vi.fn();

vi.mock("@/composition", () => ({ getContainer: async () => container }));
vi.mock("next/navigation", () => ({ notFound, redirect, useRouter: () => ({ refresh: vi.fn() }), usePathname: () => "/agreements" }));
vi.mock("next/cache", () => ({ revalidatePath }));

const actions = await import("./agreement-actions");
const { AgreementForRequest } = await import("./agreements/[agreementId]/page");
const { default: SitePage } = await import("./sites/[siteId]/page");

const AGR = "11111111-1111-4111-8111-111111111111";
const SITE = "33333333-3333-4333-8333-333333333333";
const LINE = "44444444-4444-4444-8444-444444444444";

const member = (role: MemberRole): CurrentMember => ({ status: "member", userId: "u1", email: "e@example.com", orgId: "org-1", orgName: "Org", role });
const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
};
const LINE_FORM = { description: "  Preventive maintenance visit ", visitsPerYear: "4", costPerVisit: "$892.50" };
const VALUE = { description: "Preventive maintenance visit", visitsPerYear: 4, costPerVisitCents: 89250 };

const detail = (over: Partial<AgreementDetail> = {}): AgreementDetail => ({
  id: AGR,
  number: "AG-1052",
  status: "draft",
  stage: "in_progress",
  site: { id: SITE, name: "Harbourview Towers" },
  customer: { id: "c1", name: "Harbourview Strata" },
  versions: [{ versionNo: 1, createdAt: new Date("2026-10-27T17:00:00Z") }],
  shown: {
    versionNo: 1,
    current: true,
    lines: [{ id: LINE, position: 0, description: "Preventive maintenance visit", visitsPerYear: 4, costPerVisitCents: 89250, annualCents: 357000 }],
    annualCents: 357000,
  },
  editable: true,
  serviceScope: { source: "live", takenAt: null, types: [] },
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  currentMember.mockResolvedValue(member("estimator"));
});

/** The six actions, each called with a given id (well-formed by default). */
const SIX = {
  createAgreementAction: (id = SITE) => actions.createAgreementAction(id),
  addServiceLineAction: (id = AGR) => actions.addServiceLineAction(id, form(LINE_FORM)),
  updateServiceLineAction: (id = LINE) => actions.updateServiceLineAction(id, form(LINE_FORM)),
  removeServiceLineAction: (id = LINE) => actions.removeServiceLineAction(id),
  reviseAgreementAction: (id = AGR) => actions.reviseAgreementAction(id),
  withdrawAgreementAction: (id = AGR) => actions.withdrawAgreementAction(id),
};

describe("createAgreementAction", () => {
  test("C705: a writer creates once and lands on /agreements/<id>", async () => {
    container.agreementStore.create.mockResolvedValue({ ok: true, id: AGR });
    await expect(actions.createAgreementAction(SITE)).rejects.toThrow(`NEXT_REDIRECT /agreements/${AGR}`);
    expect(container.agreementStore.create).toHaveBeenCalledTimes(1);
    expect(container.agreementStore.create).toHaveBeenCalledWith(SITE);
    expect(redirect).toHaveBeenCalledWith(`/agreements/${AGR}`);
  });

  test("C711: open_exists names the live agreement", async () => {
    container.agreementStore.create.mockResolvedValue({ ok: false, code: "open_exists", agreementId: "g9", number: "AG-1048" });
    expect(await actions.createAgreementAction(SITE)).toEqual({ status: "open_exists", agreementId: "g9", number: "AG-1048" });
  });

  test.each(["abc", ""])("C712: a malformed site id %j is not found without calling the store", async (siteId) => {
    expect(await actions.createAgreementAction(siteId)).toEqual({ status: "not_found" });
    expect(container.agreementStore.create).not.toHaveBeenCalled();
  });

  test("C701: the site page hands writers createAgreementAction bound to the site, and viewers nothing", async () => {
    const site: SiteView = {
      id: SITE,
      name: "Tower A",
      address: null,
      customerId: "c1",
      customerName: "Customer",
      siteContactId: null,
      contactName: null,
      assets: [],
      liveAgreement: null,
    };
    container.siteRegister.mockResolvedValue(site);
    const page = (await SitePage({ params: Promise.resolve({ siteId: SITE }) } as never)) as ReactElement<{ newAgreement?: () => unknown }>;
    expect(page.props.newAgreement?.name).toBe("bound createAgreementAction");
    container.agreementStore.create.mockResolvedValue({ ok: false, code: "unavailable" });
    expect(await page.props.newAgreement?.()).toEqual({ status: "unavailable" });
    expect(container.agreementStore.create).toHaveBeenCalledWith(SITE);
    currentMember.mockResolvedValue(member("viewer"));
    const viewerPage = (await SitePage({ params: Promise.resolve({ siteId: SITE }) } as never)) as ReactElement<{ newAgreement?: unknown }>;
    expect(viewerPage.props.newAgreement).toBeUndefined();
  });
});

describe("the line actions", () => {
  test("C718: a valid line is trimmed, parsed to cents, stored on the agreement and revalidates its page", async () => {
    container.serviceLineStore.add.mockResolvedValue({ ok: true, id: LINE });
    expect(await actions.addServiceLineAction(AGR, form(LINE_FORM))).toEqual({ status: "saved" });
    expect(container.serviceLineStore.add).toHaveBeenCalledTimes(1);
    expect(container.serviceLineStore.add).toHaveBeenCalledWith(AGR, VALUE);
    expect(revalidatePath).toHaveBeenCalledWith(`/agreements/${AGR}`);
  });

  test.each([
    ["add", () => actions.addServiceLineAction(AGR, form({ ...LINE_FORM, costPerVisit: "abc" }))],
    ["update", () => actions.updateServiceLineAction(LINE, form({ ...LINE_FORM, costPerVisit: "abc" }))],
  ])("C721: %s with a cost of abc is invalid and writes nothing", async (_, run) => {
    const answer = await run();
    expect(answer.status).toBe("invalid");
    expect(answer).toHaveProperty(["errors", "costPerVisit"], expect.any(String));
    expect(container.serviceLineStore.add).not.toHaveBeenCalled();
    expect(container.serviceLineStore.update).not.toHaveBeenCalled();
  });

  test("C722: a full version answers too_many", async () => {
    container.serviceLineStore.add.mockResolvedValue({ ok: false, code: "too_many" });
    expect(await actions.addServiceLineAction(AGR, form(LINE_FORM))).toEqual({ status: "too_many" });
  });

  test("C724: remove and update call the store once and answer removed and saved", async () => {
    container.serviceLineStore.remove.mockResolvedValue({ ok: true });
    expect(await actions.removeServiceLineAction(LINE)).toEqual({ status: "removed" });
    expect(container.serviceLineStore.remove).toHaveBeenCalledTimes(1);
    expect(container.serviceLineStore.remove).toHaveBeenCalledWith(LINE);
    container.serviceLineStore.update.mockResolvedValue({ ok: true });
    expect(await actions.updateServiceLineAction(LINE, form(LINE_FORM))).toEqual({ status: "saved" });
    expect(container.serviceLineStore.update).toHaveBeenCalledTimes(1);
    expect(container.serviceLineStore.update).toHaveBeenCalledWith(LINE, VALUE);
  });

  test("C737: locked passes through each line action", async () => {
    container.serviceLineStore.add.mockResolvedValue({ ok: false, code: "locked" });
    container.serviceLineStore.update.mockResolvedValue({ ok: false, code: "locked" });
    container.serviceLineStore.remove.mockResolvedValue({ ok: false, code: "locked" });
    expect(await SIX.addServiceLineAction()).toEqual({ status: "locked" });
    expect(await SIX.updateServiceLineAction()).toEqual({ status: "locked" });
    expect(await SIX.removeServiceLineAction()).toEqual({ status: "locked" });
  });

  test("C745: org fields in the form never reach the store", async () => {
    container.serviceLineStore.add.mockResolvedValue({ ok: true, id: LINE });
    await actions.addServiceLineAction(AGR, form({ ...LINE_FORM, orgId: "other-org", org_id: "other-org" }));
    expect(container.serviceLineStore.add.mock.calls).toEqual([[AGR, VALUE]]);
  });
});

describe("revise and withdraw", () => {
  test("C731: revise calls the transition once and lands on the agreement", async () => {
    container.transitionAgreement.mockResolvedValue({ ok: true, status: "draft", eventId: "e1" });
    await expect(actions.reviseAgreementAction(AGR)).rejects.toThrow(`NEXT_REDIRECT /agreements/${AGR}`);
    expect(container.transitionAgreement).toHaveBeenCalledTimes(1);
    expect(container.transitionAgreement).toHaveBeenCalledWith({ agreementId: AGR, command: { type: "revise" } });
  });

  test("C733: withdraw calls the transition once and answers withdrawn", async () => {
    container.transitionAgreement.mockResolvedValue({ ok: true, status: "withdrawn", eventId: "e1" });
    expect(await actions.withdrawAgreementAction(AGR)).toEqual({ status: "withdrawn" });
    expect(container.transitionAgreement).toHaveBeenCalledTimes(1);
    expect(container.transitionAgreement).toHaveBeenCalledWith({ agreementId: AGR, command: { type: "withdraw" } });
  });

  test.each(["conflict", "invalid_transition", "not_found"] as const)("C743: a %s refusal passes through both", async (code) => {
    container.transitionAgreement.mockResolvedValue({ ok: false, error: { code, command: "revise" } });
    expect(await actions.reviseAgreementAction(AGR)).toEqual({ status: code });
    expect(await actions.withdrawAgreementAction(AGR)).toEqual({ status: code });
    expect(redirect).not.toHaveBeenCalled();
  });
});

describe("refusals before any write", () => {
  test.each(Object.keys(SIX) as (keyof typeof SIX)[])("C739: a viewer calling %s is forbidden and nothing is called", async (name) => {
    currentMember.mockResolvedValue(member("viewer"));
    expect(await SIX[name]()).toEqual({ status: "forbidden" });
    for (const write of WRITES) expect(write).not.toHaveBeenCalled();
  });

  test.each(Object.keys(SIX) as (keyof typeof SIX)[])("C741: %s with a malformed id is not found and calls no store", async (name) => {
    expect(await SIX[name]("abc")).toEqual({ status: "not_found" });
    for (const write of WRITES) expect(write).not.toHaveBeenCalled();
  });

  test("C744: an unavailable store passes through every write action", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    container.agreementStore.create.mockResolvedValue({ ok: false, code: "unavailable" });
    container.serviceLineStore.add.mockResolvedValue({ ok: false, code: "unavailable" });
    container.serviceLineStore.update.mockResolvedValue({ ok: false, code: "unavailable" });
    container.serviceLineStore.remove.mockResolvedValue({ ok: false, code: "unavailable" });
    container.transitionAgreement.mockRejectedValue(new Error("Supabase error XX000: boom"));
    for (const [name, run] of Object.entries(SIX)) expect(await run(), name).toEqual({ status: "unavailable" });
    expect(console.error).toHaveBeenCalledTimes(2);
  });
});

describe("the agreement page", () => {
  const render = async (search: Record<string, string> = {}, agreementId = AGR) =>
    renderToStaticMarkup((await AgreementForRequest({ agreementId, searchParams: Promise.resolve(search) } as never)) as ReactElement);

  test.each(["abc", "1.5", ""])("C727: ?version=%j reaches the reader as no version", async (version) => {
    container.agreementReader.get.mockResolvedValue(detail());
    await render({ version });
    expect(container.agreementReader.get).toHaveBeenCalledWith(AGR, undefined);
  });

  test("C727: ?version=1 reaches the reader as 1", async () => {
    container.agreementReader.get.mockResolvedValue(detail());
    await render({ version: "1" });
    expect(container.agreementReader.get).toHaveBeenCalledWith(AGR, 1);
  });

  test("C740: a viewer sees a draft with lines and no control", async () => {
    currentMember.mockResolvedValue(member("viewer"));
    container.agreementReader.get.mockResolvedValue(detail());
    const html = await render();
    expect(html).toContain("Preventive maintenance visit");
    for (const label of ["New agreement", "Add line", "Edit", "Remove", "Start version", "Withdraw"]) expect(html, label).not.toContain(`>${label}`);
  });

  test("C740: a writer sees the controls on the same draft", async () => {
    container.agreementReader.get.mockResolvedValue(detail());
    const html = await render();
    for (const label of ["Add line", "Edit", "Remove", "Withdraw"]) expect(html, label).toContain(`>${label}</button>`);
  });

  test("C824: the page shows the reader's service scope as it comes", async () => {
    const takenAt = new Date("2026-10-27T18:00:00Z");
    container.agreementReader.get.mockResolvedValue(
      detail({
        status: "sent",
        editable: false,
        serviceScope: {
          source: "frozen",
          takenAt,
          types: [{ code: "RTU", name: "Rooftop unit", tasks: ["Replace filters"], assets: [{ unitNo: "RTU-1", typeModel: null, location: null }] }],
        },
      }),
    );
    const html = await render();
    const day = new Intl.DateTimeFormat("en-CA", { dateStyle: "medium", timeZone: "America/Vancouver" }).format(takenAt);
    expect(html).toContain(`As recorded on ${day}`);
    expect(html).toContain("Rooftop unit, 1 unit");
  });

  test("C741: a malformed id and a missing agreement are 404", async () => {
    await expect(render({}, "abc")).rejects.toThrow("NEXT_NOT_FOUND");
    expect(container.agreementReader.get).not.toHaveBeenCalled();
    container.agreementReader.get.mockResolvedValue(null);
    await expect(render()).rejects.toThrow("NEXT_NOT_FOUND");
  });

  test("a signed-out member goes to /login", async () => {
    currentMember.mockResolvedValue({ status: "signed_out" });
    await expect(render()).rejects.toThrow("NEXT_REDIRECT /login");
  });
});

