import { beforeEach, describe, expect, test, vi } from "vitest";
import type { CurrentMember } from "@/application/ports";
import { REPORT_KEYS } from "@/domain/reports";

const currentMember = vi.fn<() => Promise<CurrentMember>>();
const ok = <T,>(value: T) => ({ ok: true as const, value });
const reports = {
  headline: vi.fn(),
  funnel: vi.fn(async () => ok([{ stage: "created", n: 4, valueCents: 479996 }, { stage: "sent", n: 2, valueCents: null }])),
  aging: vi.fn(async () => ok({ medians: [{ stage: "Created to sent", days: 28.5 }], stuck: [{ agreementId: "a1", number: "AG-1", customer: "Acme", site: "Plant", status: "sent", ageDays: 9 }] })),
  losses: vi.fn(async () => ok([{ agreementId: "a1", number: "AG-1", customer: "Acme", site: "Plant", outcome: "refused", reason: "=HYPERLINK(1)", occurred: "2027-03-11", valueCents: 119999 }])),
  renewals: vi.fn(async () => ok([{ agreementId: "a2", number: "AG-2", customer: "Acme", site: "Plant", termEnd: "2027-04-01", daysLeft: 30, bucket: 30, kind: "auto", valueCents: 119999 }])),
  revenueByCustomer: vi.fn(async () => ok([{ customerId: "c1", customer: "Acme", agreements: 2, valueCents: 239998 }])),
  revenueByType: vi.fn(async () => ok([{ type: "Aaa Type", valueCents: 10000 }])),
};

vi.mock("@/composition", () => ({ getContainer: async () => ({ currentMember, reports, clock: { now: () => new Date("2027-06-15T20:00:00Z") } }) }));

const { GET } = await import("./route");

const as = (role: "owner" | "admin" | "estimator" | "viewer", extra: Partial<Extract<CurrentMember, { status: "member" }>> = {}) =>
  currentMember.mockResolvedValue({ status: "member", userId: "u1", email: "o@example.com", orgId: "org-1", orgName: "Org", role, ...extra });
const get = (query: string) => GET(new Request(`https://app.example.com/reports/export?${query}`));

beforeEach(() => {
  vi.clearAllMocks();
  as("owner");
});

describe("GET /reports/export (reporting Surface)", () => {
  test("C5741: an owner downloads the funnel as text/csv with an attachment name", async () => {
    const response = await get("report=funnel&from=2027-01-01&to=2027-03-31");
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/csv; charset=utf-8");
    expect(response.headers.get("Content-Disposition")).toBe('attachment; filename="reports-funnel-2027-01-01-2027-03-31.csv"');
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await response.text()).toBe("Stage,Agreements,Value\r\ncreated,4,4799.96\r\nsent,2,\r\n");
    expect(reports.funnel).toHaveBeenCalledWith({ from: "2027-01-01", to: "2027-03-31" });
  });

  test("C5741: with no dates the range is the 12 months ending today in Vancouver", async () => {
    await get("report=funnel");
    expect(reports.funnel).toHaveBeenCalledWith({ from: "2026-06-16", to: "2027-06-15" });
  });

  test.each(REPORT_KEYS)("C5741: an owner gets 200 for the %s report", async (key) => {
    expect((await get(`report=${key}`)).status).toBe(200);
  });

  test.each(["", "report=", "report=banana", "report=headline", "report=revenue_customer%27;drop"])("C5741: %j is an unknown report, 400", async (query) => {
    expect((await get(query)).status).toBe(400);
  });

  test.each(["from=banana", "to=2027-13-01", "from=2027-04-01&to=2027-03-01", "from=2027-1-1"])("C5741: %s is a bad date, 400", async (dates) => {
    expect((await get(`report=funnel&${dates}`)).status).toBe(400);
    expect(reports.funnel).not.toHaveBeenCalled();
  });

  test("C5741: a start date after today with no end is 400, not the default range", async () => {
    expect((await get("report=funnel&from=2027-06-16")).status).toBe(400);
    expect((await get("report=funnel&from=2027-06-15")).status).toBe(200);
  });

  test("C5741: signed out is 401 and nothing is read", async () => {
    currentMember.mockResolvedValue({ status: "signed_out" });
    expect((await get("report=funnel")).status).toBe(401);
    expect(reports.funnel).not.toHaveBeenCalled();
  });

  test("C5741: a person with no workspace is 403", async () => {
    currentMember.mockResolvedValue({ status: "no_membership", email: "x@example.com" });
    expect((await get("report=funnel")).status).toBe(403);
  });

  test("C5741: a viewer is 403 for every report and nothing is read", async () => {
    as("viewer");
    for (const key of REPORT_KEYS) expect((await get(`report=${key}`)).status).toBe(403);
    expect(reports.funnel).not.toHaveBeenCalled();
  });

  test.each(["revenue_customer", "revenue_type"])("C5741: an estimator asking %s is 403 and nothing is read", async (key) => {
    as("estimator");
    expect((await get(`report=${key}`)).status).toBe(403);
    expect(reports.revenueByCustomer).not.toHaveBeenCalled();
    expect(reports.revenueByType).not.toHaveBeenCalled();
  });

  test("C5741: an estimator's funnel and losses files hold no money column", async () => {
    as("estimator");
    expect(await (await get("report=funnel")).text()).toBe("Stage,Agreements\r\ncreated,4\r\nsent,2\r\n");
    const losses = await (await get("report=losses")).text();
    expect(losses.split("\r\n")[0]).toBe("Agreement,Customer,Site,Outcome,Reason,Date");
    expect(losses).not.toContain("1199.99");
  });

  test("C5741: a reason that starts with = is written with a leading quote", async () => {
    expect(await (await get("report=losses")).text()).toContain("'=HYPERLINK(1)");
  });

  test("C5741: an owner of a frozen workspace, whose role is viewer, still downloads (AC 17)", async () => {
    as("viewer", { billingRole: "owner", frozen: true });
    expect((await get("report=funnel")).status).toBe(200);
  });

  test("C5741: a report the database cannot read is 503, and one it refuses is 403", async () => {
    reports.funnel.mockResolvedValueOnce({ ok: false, code: "unavailable" } as never);
    expect((await get("report=funnel")).status).toBe(503);
    reports.funnel.mockResolvedValueOnce({ ok: false, code: "forbidden" } as never);
    expect((await get("report=funnel")).status).toBe(403);
  });
});
