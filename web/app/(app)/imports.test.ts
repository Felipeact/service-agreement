import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { CurrentMember, MemberRole, SiteView } from "@/application/ports";

const currentMember = vi.fn<() => Promise<CurrentMember>>();
const container = {
  currentMember,
  siteRegister: vi.fn(),
  listImportJobs: vi.fn(),
  startImport: vi.fn(),
  confirmImportUpload: vi.fn(),
  discardImport: vi.fn(),
  readImport: vi.fn(),
};
const STORE_METHODS = ["startImport", "confirmImportUpload", "discardImport"] as const;

const notFound = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});
const redirect = vi.fn((path: string) => {
  throw new Error(`NEXT_REDIRECT ${path}`);
});

vi.mock("@/composition", () => ({ getContainer: async () => container }));
vi.mock("next/navigation", () => ({ notFound, redirect, useRouter: () => ({ refresh: vi.fn() }), usePathname: () => "/sites" }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));

const actions = await import("./import-actions");
const { default: ImportPage } = await import("./sites/[siteId]/import/page");
const { default: Loading } = await import("./sites/[siteId]/import/loading");

const ORG = "org-1";
const SITE = "33333333-3333-4333-8333-333333333333";
const JOB = "66666666-6666-4666-8666-666666666666";
const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const member = (role: MemberRole): CurrentMember => ({ status: "member", userId: "u1", email: "e@example.com", orgId: ORG, orgName: "Org", role });
const site: SiteView = {
  id: SITE,
  name: "Tower A",
  address: null,
  customerId: "c1",
  customerName: "Kettle Test",
  siteContactId: null,
  contactName: null,
  assets: [],
};

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
};

beforeEach(() => {
  vi.clearAllMocks();
  currentMember.mockResolvedValue(member("estimator"));
});

describe("startImportAction", () => {
  test("C403: a writer's valid file starts one job with the member's org, the route's site and the extension's type", async () => {
    const started = { ok: true, jobId: JOB, signedUrl: "https://example.supabase.co/sign?token=t", contentType: XLSX };
    container.startImport.mockResolvedValue(started);

    const result = await actions.startImportAction(SITE, form({ fileName: "Units.xlsx", size: "2048" }));

    expect(container.startImport).toHaveBeenCalledTimes(1);
    expect(container.startImport).toHaveBeenCalledWith(ORG, SITE, { name: "Units.xlsx", size: 2048, contentType: XLSX });
    expect(result).toEqual({ status: "started", jobId: JOB, signedUrl: started.signedUrl, contentType: XLSX });
  });

  test.each([
    ["report.txt", "100", "Choose an Excel (.xlsx), CSV, Word (.docx) or PDF file"],
    ["empty.csv", "0", "This file is empty"],
    ["big.pdf", "20971521", "Files can be up to 20 MB"],
    [`${"n".repeat(252)}.csv`, "100", "File name must be 255 characters or fewer"],
  ])("C412: %s of %s bytes -> invalid, no store call", async (fileName, size, message) => {
    expect(await actions.startImportAction(SITE, form({ fileName, size }))).toEqual({ status: "invalid", message });
    for (const name of STORE_METHODS) expect(container[name], name).not.toHaveBeenCalled();
  });

  test("C430: orgId, siteId, status and contentType in the form are ignored", async () => {
    container.startImport.mockResolvedValue({ ok: true, jobId: JOB, signedUrl: "u", contentType: XLSX });

    await actions.startImportAction(
      SITE,
      form({ fileName: "Units.xlsx", size: "2048", orgId: "evil-org", siteId: "evil-site", status: "uploaded", contentType: "text/plain" }),
    );

    const [orgId, siteId, file] = container.startImport.mock.calls[0];
    expect(orgId).toBe(ORG);
    expect(siteId).toBe(SITE);
    expect(file).toEqual({ name: "Units.xlsx", size: 2048, contentType: XLSX });
    expect(file).not.toHaveProperty("status");
  });

  test.each([["forbidden"], ["not_found"], ["unavailable"]])("C431: the store's %s comes back as the state", async (code) => {
    container.startImport.mockResolvedValue({ ok: false, code });
    expect(await actions.startImportAction(SITE, form({ fileName: "Units.xlsx", size: "2048" }))).toEqual({ status: code });
  });
});

describe("the import actions refuse a viewer", () => {
  test.each([
    ["startImportAction", () => actions.startImportAction(SITE, form({ fileName: "Units.xlsx", size: "2048" }))],
    ["confirmImportAction", () => actions.confirmImportAction(JOB)],
    ["discardImportAction", () => actions.discardImportAction(JOB)],
  ] as [string, () => Promise<unknown>][])("C425: %s -> forbidden, no store call", async (_name, run) => {
    currentMember.mockResolvedValue(member("viewer"));
    expect(await run()).toEqual({ status: "forbidden" });
    for (const name of STORE_METHODS) expect(container[name], name).not.toHaveBeenCalled();
  });
});

describe("confirm and discard", () => {
  test.each([
    ["confirmImportAction", () => actions.confirmImportAction("not-a-uuid")],
    ["discardImportAction", () => actions.discardImportAction("not-a-uuid")],
  ] as [string, () => Promise<unknown>][])("C427: %s with a malformed id -> not_found, no store call", async (_name, run) => {
    expect(await run()).toEqual({ status: "not_found" });
    for (const name of STORE_METHODS) expect(container[name], name).not.toHaveBeenCalled();
  });

  test("C406: confirm maps the store's ok to uploaded", async () => {
    container.confirmImportUpload.mockResolvedValue({ ok: true });
    expect(await actions.confirmImportAction(JOB)).toEqual({ status: "uploaded" });
    expect(container.confirmImportUpload).toHaveBeenCalledWith(JOB);
  });

  test("C421: discard maps the store's ok to discarded", async () => {
    container.discardImport.mockResolvedValue({ ok: true });
    expect(await actions.discardImportAction(JOB)).toEqual({ status: "discarded" });
    expect(container.discardImport).toHaveBeenCalledWith(JOB);
  });
});

describe("the import page", () => {
  const render = async (siteId: string) => renderToStaticMarkup((await ImportPage({ params: Promise.resolve({ siteId }) } as never)) as ReactElement);

  test.each([
    ["a non-uuid id", "not-a-uuid"],
    ["a missing or other-org site", SITE],
  ])("C426: %s -> notFound()", async (_name, siteId) => {
    container.siteRegister.mockResolvedValue(null);
    await expect(render(siteId)).rejects.toThrow("NEXT_NOT_FOUND");
    expect(container.listImportJobs).not.toHaveBeenCalled();
  });

  test("C426: an existing site renders its import page", async () => {
    container.siteRegister.mockResolvedValue(site);
    container.listImportJobs.mockResolvedValue([]);
    const out = await render(SITE);
    expect(out).toContain("Tower A");
    expect(container.listImportJobs).toHaveBeenCalledWith(SITE);
  });

  test("C434: the loading state has an h1 and a Loading… status", () => {
    const out = renderToStaticMarkup(createElement(Loading));
    expect(out).toMatch(/<h1[^>]*>/);
    expect(out).toMatch(/role="status"[^>]*>Loading…/);
  });
});

describe("readImportAction", () => {
  test("C480: a viewer is forbidden and nothing is read", async () => {
    currentMember.mockResolvedValue(member("viewer"));
    expect(await actions.readImportAction(JOB)).toEqual({ status: "forbidden" });
    expect(container.readImport).not.toHaveBeenCalled();
  });

  test("C481: a job id that is not a uuid is not_found, and nothing is read", async () => {
    expect(await actions.readImportAction("not-a-uuid")).toEqual({ status: "not_found" });
    expect(container.readImport).not.toHaveBeenCalled();
  });

  test.each([
    ["parsed", { ok: true, outcome: { status: "parsed", tables: 1, rows: 48 } }, { status: "parsed", tables: 1, rows: 48 }, 1],
    ["unreadable", { ok: true, outcome: { status: "unreadable", reason: "no_table" } }, { status: "unreadable", reason: "no_table" }, 1],
    ["not_ready", { ok: false, code: "not_ready" }, { status: "not_ready" }, 0],
  ])("C498: %s passes through", async (_name, answer, state, refreshes) => {
    const { refresh } = await import("next/cache");
    container.readImport.mockResolvedValue(answer);

    expect(await actions.readImportAction(JOB)).toEqual(state);
    expect(container.readImport).toHaveBeenCalledWith(JOB);
    expect(refresh).toHaveBeenCalledTimes(refreshes);
  });
});
