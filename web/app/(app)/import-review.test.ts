import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { CurrentMember, ImportReview, ImportRowView, MemberRole } from "@/application/ports";

const currentMember = vi.fn<() => Promise<CurrentMember>>();
const container = {
  currentMember,
  listAssetTypes: vi.fn(),
  siteRegister: vi.fn(),
  reviewImport: vi.fn(),
  updateImportRow: vi.fn(),
  skipImportRow: vi.fn(),
  mapImportType: vi.fn(),
  commitImport: vi.fn(),
  discardImport: vi.fn(),
};
const WRITES = ["updateImportRow", "skipImportRow", "mapImportType", "commitImport", "reviewImport", "listAssetTypes"] as const;

const notFound = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});
const redirect = vi.fn((to: string) => {
  throw new Error(`NEXT_REDIRECT ${to}`);
});
const refresh = vi.fn();

vi.mock("@/composition", () => ({ getContainer: async () => container }));
vi.mock("next/navigation", () => ({ notFound, redirect, useRouter: () => ({ refresh: vi.fn() }), usePathname: () => "/imports" }));
vi.mock("next/cache", () => ({ refresh }));

const actions = await import("./import-actions");
const { ReviewForRequest } = await import("./imports/[jobId]/page");

const JOB = "66666666-6666-4666-8666-666666666666";
const ROW = "77777777-7777-4777-8777-777777777777";
const SITE = "33333333-3333-4333-8333-333333333333";
const RTU = "88888888-8888-4888-8888-888888888888";

const member = (role: MemberRole): CurrentMember => ({ status: "member", userId: "u1", email: "e@example.com", orgId: "org-1", orgName: "Org", role });
const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
};
const row = (over: Partial<ImportRowView> = {}): ImportRowView => ({
  id: "r1",
  position: 1,
  assetTypeRaw: "Rooftop unit",
  assetTypeId: RTU,
  unitNo: "RTU-1",
  typeModel: null,
  location: null,
  confidence: "high",
  sourceRef: null,
  skipped: false,
  assetId: null,
  ...over,
});
const review = (rows: ImportRowView[], status: "extracted" | "committed" = "extracted"): ImportReview => ({
  job: { id: JOB, siteId: SITE, siteName: "Brookhaven", originalName: "units.xlsx", status, committed: null },
  rows,
});

beforeEach(() => {
  vi.clearAllMocks();
  currentMember.mockResolvedValue(member("estimator"));
  container.listAssetTypes.mockResolvedValue([{ id: RTU, code: "RTU", name: "Rooftop Unit" }]);
});

const call = {
  update: (id = ROW) => actions.updateImportRowAction(id, form({ assetTypeId: RTU, unitNo: "", typeModel: "", location: "" })),
  skip: (id = ROW) => actions.skipImportRowAction(id, true),
  map: (id = JOB) => actions.mapImportTypeAction(id, form({ rawText: "Widget", assetTypeId: RTU })),
  commit: (id = JOB) => actions.commitImportAction(id),
};

describe("the review page", () => {
  const render = (jobId: string) => ReviewForRequest({ jobId, searchParams: Promise.resolve({}) } as never);

  test("C607: a malformed id is not found without reading the job", async () => {
    await expect(render("not-a-uuid")).rejects.toThrow("NEXT_NOT_FOUND");
    expect(container.reviewImport).not.toHaveBeenCalled();
  });

  test("C607: a job the reader returns null for is not found", async () => {
    container.reviewImport.mockResolvedValue(null);
    await expect(render(JOB)).rejects.toThrow("NEXT_NOT_FOUND");
  });

  test("C607: a signed-out member goes to /login", async () => {
    currentMember.mockResolvedValue({ status: "signed_out" });
    await expect(render(JOB)).rejects.toThrow("NEXT_REDIRECT /login");
  });
});

describe("updateImportRowAction", () => {
  test("C617: a valid edit is trimmed, saved and refreshes", async () => {
    container.updateImportRow.mockResolvedValue({ ok: true });
    const answer = await actions.updateImportRowAction(ROW, form({ assetTypeId: RTU, unitNo: "  RTU-1 ", typeModel: "Carrier", location: "" }));
    expect(answer).toEqual({ status: "saved" });
    expect(container.updateImportRow).toHaveBeenCalledTimes(1);
    expect(container.updateImportRow).toHaveBeenCalledWith(ROW, { assetTypeId: RTU, unitNo: "RTU-1", typeModel: "Carrier", location: null });
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  test.each<[string, Record<string, string>, string]>([
    ["a type of no org type", { assetTypeId: "99999999-9999-4999-8999-999999999999" }, "assetTypeId"],
    ["a 41-character unit", { unitNo: "u".repeat(41) }, "unitNo"],
    ["a 121-character type/model", { typeModel: "m".repeat(121) }, "typeModel"],
    ["a 301-character location", { location: "l".repeat(301) }, "location"],
  ])("C618: %s is refused before any write", async (_, patch, field) => {
    const answer = await actions.updateImportRowAction(ROW, form({ assetTypeId: RTU, unitNo: "", typeModel: "", location: "", ...patch }));
    expect(answer.status).toBe("invalid");
    expect(answer).toHaveProperty(["errors", field]);
    if (field === "assetTypeId") expect(answer).toHaveProperty(["errors", "assetTypeId"], "Choose an equipment type");
    expect(container.updateImportRow).not.toHaveBeenCalled();
  });
});

describe("skipImportRowAction and mapImportTypeAction", () => {
  test("C623: skip and include call setSkipped with the value given", async () => {
    container.skipImportRow.mockResolvedValue({ ok: true });
    expect(await actions.skipImportRowAction(ROW, true)).toEqual({ status: "saved" });
    expect(await actions.skipImportRowAction(ROW, false)).toEqual({ status: "saved" });
    expect(container.skipImportRow.mock.calls).toEqual([
      [ROW, true],
      [ROW, false],
    ]);
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  test("C621: a spelling is mapped by its normalized text", async () => {
    container.mapImportType.mockResolvedValue({ ok: true, rows: 14 });
    expect(await call.map()).toEqual({ status: "mapped", rows: 14 });
    expect(container.mapImportType).toHaveBeenCalledWith(JOB, "widget", RTU);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  test("C621: a type that is not the org's is invalid and maps nothing", async () => {
    expect(await actions.mapImportTypeAction(JOB, form({ rawText: "Widget", assetTypeId: "99999999-9999-4999-8999-999999999999" }))).toEqual({ status: "invalid" });
    expect(container.mapImportType).not.toHaveBeenCalled();
  });
});

describe("commitImportAction", () => {
  test("C629: blocking rows are counted and nothing is committed", async () => {
    container.reviewImport.mockResolvedValue(
      review([row({ id: "a", assetTypeId: null }), row({ id: "b", unitNo: "u".repeat(41) }), row({ id: "c", location: "l".repeat(301) }), row({ id: "d" }), row({ id: "e", assetTypeId: null, skipped: true })]),
    );
    expect(await call.commit()).toEqual({ status: "incomplete", count: 3 });
    expect(container.commitImport).not.toHaveBeenCalled();
  });

  test("C630: no included row is nothing_to_add and nothing is committed", async () => {
    for (const rows of [[row({ skipped: true })], []]) {
      container.reviewImport.mockResolvedValue(review(rows));
      expect(await call.commit()).toEqual({ status: "nothing_to_add" });
    }
    expect(container.commitImport).not.toHaveBeenCalled();
  });

  test("C642: the action takes only the job id", () => {
    expect(actions.commitImportAction.length).toBe(1);
    const source = readFileSync(path.join(__dirname, "import-actions.ts"), "utf8");
    expect(source).toMatch(/export async function commitImportAction\(jobId: string\): Promise<CommitState>/);
  });
});

describe("the four actions", () => {
  test.each(["update", "skip", "map", "commit"] as const)("C639: a viewer is forbidden from %s and nothing is called", async (name) => {
    currentMember.mockResolvedValue(member("viewer"));
    expect(await call[name]()).toEqual({ status: "forbidden" });
    for (const method of WRITES) expect(container[method]).not.toHaveBeenCalled();
  });

  test.each(["update", "skip", "map", "commit"] as const)("C640: %s with a malformed id is not_found and nothing is called", async (name) => {
    expect(await call[name]("not-a-uuid")).toEqual({ status: "not_found" });
    for (const method of WRITES) expect(container[method]).not.toHaveBeenCalled();
  });

  test("C636: locked passes through every row action and discard", async () => {
    container.updateImportRow.mockResolvedValue({ ok: false, code: "locked" });
    container.skipImportRow.mockResolvedValue({ ok: false, code: "locked" });
    container.mapImportType.mockResolvedValue({ ok: false, code: "locked" });
    container.discardImport.mockResolvedValue({ ok: false, code: "locked" });
    expect(await call.update()).toEqual({ status: "locked" });
    expect(await call.skip()).toEqual({ status: "locked" });
    expect(await call.map()).toEqual({ status: "locked" });
    expect(await actions.discardImportAction(JOB)).toEqual({ status: "locked" });
  });

  const failures = ["locked", "not_found", "forbidden", "unavailable"] as const;

  test.each(failures)("C647: update and skip pass %s through without refresh", async (code) => {
    container.updateImportRow.mockResolvedValue({ ok: false, code });
    container.skipImportRow.mockResolvedValue({ ok: false, code });
    expect(await call.update()).toEqual({ status: code });
    expect(await call.skip()).toEqual({ status: code });
    expect(refresh).not.toHaveBeenCalled();
  });

  test.each(failures)("C647: map passes %s through without refresh", async (code) => {
    container.mapImportType.mockResolvedValue({ ok: false, code });
    expect(await call.map()).toEqual({ status: code });
    expect(refresh).not.toHaveBeenCalled();
  });

  test("C647: saved and mapped refresh", async () => {
    container.updateImportRow.mockResolvedValue({ ok: true });
    container.skipImportRow.mockResolvedValue({ ok: true });
    container.mapImportType.mockResolvedValue({ ok: true, rows: 2 });
    expect(await call.update()).toEqual({ status: "saved" });
    expect(await call.skip()).toEqual({ status: "saved" });
    expect(await call.map()).toEqual({ status: "mapped", rows: 2 });
    expect(refresh).toHaveBeenCalledTimes(3);
  });

  test.each<[string, unknown, unknown, number]>([
    ["committed", { ok: true, added: 2, skipped: 1 }, { status: "committed", added: 2, skipped: 1 }, 1],
    ["not_ready", { ok: false, code: "not_ready" }, { status: "not_ready" }, 0],
    ["not_found", { ok: false, code: "not_found" }, { status: "not_found" }, 0],
    ["forbidden", { ok: false, code: "forbidden" }, { status: "forbidden" }, 0],
    ["unavailable", { ok: false, code: "unavailable" }, { status: "unavailable" }, 0],
  ])("C647: commit passes %s through", async (_, answer, expected, refreshes) => {
    container.reviewImport.mockResolvedValue(review([row()]));
    container.commitImport.mockResolvedValue(answer);
    expect(await call.commit()).toEqual(expected);
    expect(refresh).toHaveBeenCalledTimes(refreshes);
  });

  test("C647: commit answers incomplete with the re-read count when the database refuses", async () => {
    container.reviewImport.mockResolvedValueOnce(review([row()])).mockResolvedValueOnce(review([row({ assetTypeId: null }), row({ id: "r2", assetTypeId: null })]));
    container.commitImport.mockResolvedValue({ ok: false, code: "incomplete" });
    expect(await call.commit()).toEqual({ status: "incomplete", count: 2 });
    expect(refresh).not.toHaveBeenCalled();
  });
});
