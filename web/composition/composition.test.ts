import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import type {
  AddServiceLineResult,
  AgreementDetail,
  AgreementReader,
  AgreementStore,
  CreateAgreementResult,
  ServiceLineStore,
  ServiceLineWriteResult,
  SiteView,
} from "@/application/ports";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ getAll: () => [], set: () => {} }),
}));
vi.mock("next/server", () => ({ connection: async () => {} }));
// Both clients call through; the wrappers only record how getContainer built them (C1517).
vi.mock("@supabase/supabase-js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@supabase/supabase-js")>();
  return { ...actual, createClient: vi.fn(actual.createClient) };
});
vi.mock("@supabase/ssr", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@supabase/ssr")>();
  return { ...actual, createServerClient: vi.fn(actual.createServerClient) };
});

const URL_KEY = "NEXT_PUBLIC_SUPABASE_URL";
const PUBLISHABLE_KEY = "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY";

function setEnv(url: string | undefined, key: string | undefined) {
  vi.stubEnv(URL_KEY, url as string);
  vi.stubEnv(PUBLISHABLE_KEY, key as string);
  if (url === undefined) delete process.env[URL_KEY];
  if (key === undefined) delete process.env[PUBLISHABLE_KEY];
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("composition root", () => {
  test("C22: index.ts starts with server-only and getContainer() wires the use cases and the clock", async () => {
    const source = readFileSync(path.join(__dirname, "index.ts"), "utf8");
    const firstStatement = source
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line !== "" && !line.startsWith("//") && !line.startsWith("/*") && !line.startsWith("*"));
    expect(firstStatement).toBe('import "server-only";');

    setEnv("https://example.supabase.co", "sb_publishable_test");
    const { getContainer } = await import("./index");
    const container = await getContainer();
    expect(typeof container.transitionAgreement).toBe("function");
    expect(typeof container.transitionContract).toBe("function");
    expect(container.clock.now()).toBeInstanceOf(Date);
  });

  test("C1648: getContainer() exposes the contract reader, store and renderer, built from the member's client and the document adapter", async () => {
    setEnv("https://example.supabase.co", "sb_publishable_test");
    const { getContainer } = await import("./index");
    const container = await getContainer();
    expect(typeof container.contractReader.get).toBe("function");
    expect(typeof container.contractStore.create).toBe("function");
    expect(typeof container.contractRenderer.renderContract).toBe("function");

    const source = readFileSync(path.join(__dirname, "index.ts"), "utf8");
    expect(source).toContain("contractReader: supabaseContractReader(supabase)");
    expect(source).toContain("contractStore: supabaseContractStore(supabase)");
    expect(source).toContain("contractRenderer: reactPdfContractRenderer");
    expect(Object.keys(container).filter((key) => /^generateContract|^createContract/.test(key))).toEqual([]);
  });

  test("C1517: the invitation sender gets its own client with no session and no refresh, and the cookie client is built apart", async () => {
    setEnv("https://example.supabase.co", "sb_publishable_test");
    const { createClient } = await import("@supabase/supabase-js");
    const { createServerClient } = await import("@supabase/ssr");
    vi.mocked(createClient).mockClear();
    vi.mocked(createServerClient).mockClear();

    const { getContainer } = await import("./index");
    const container = await getContainer();

    expect(createClient).toHaveBeenCalledTimes(1);
    expect(createClient).toHaveBeenCalledWith("https://example.supabase.co", "sb_publishable_test", { auth: { persistSession: false, autoRefreshToken: false } });
    expect(createServerClient).toHaveBeenCalledTimes(1);
    const [, , options] = vi.mocked(createServerClient).mock.calls[0];
    expect(typeof (options as { cookies: { getAll: unknown } }).cookies.getAll).toBe("function");
    for (const name of ["inviteMember", "revokeInvitation", "setMemberRole", "removeMember", "listMembers", "listInvitations", "acceptInvitations"] as const) {
      expect(typeof container[name], name).toBe("function");
    }
  });

  test("C1575: getContainer() exposes searchRecords, built on the session client and not on the key-less invitation client", async () => {
    setEnv("https://example.supabase.co", "sb_publishable_test");
    const { createClient } = await import("@supabase/supabase-js");
    const { createServerClient } = await import("@supabase/ssr");
    vi.mocked(createClient).mockClear();
    vi.mocked(createServerClient).mockClear();
    const { getContainer } = await import("./index");
    const container = await getContainer();
    expect(typeof container.searchRecords).toBe("function");
    // The only supabase-js client is the invitation sender's (AD-131); search must come from the cookie client.
    expect(createClient).toHaveBeenCalledTimes(1);
    expect(createServerClient).toHaveBeenCalledTimes(1);
    const serverClient = vi.mocked(createServerClient).mock.results[0].value as { rpc: (...args: unknown[]) => unknown };
    const rpc = vi.spyOn(serverClient, "rpc").mockResolvedValue({ data: [], error: null } as never);
    const plainClient = vi.mocked(createClient).mock.results[0].value as { rpc: (...args: unknown[]) => unknown };
    const plainRpc = vi.spyOn(plainClient, "rpc");
    await container.searchRecords("x");
    expect(rpc).toHaveBeenCalledWith("search_records", expect.anything());
    expect(plainRpc).not.toHaveBeenCalled();
  });

  test("C27: getContainer() wires the sign-in link, link verification, sign out and the current member", async () => {
    setEnv("https://example.supabase.co", "sb_publishable_test");
    const { getContainer } = await import("./index");
    const container = await getContainer();
    expect(typeof container.requestSignInLink).toBe("function");
    expect(typeof container.verifyEmailLink).toBe("function");
    expect(typeof container.signOut).toBe("function");
    expect(typeof container.currentMember).toBe("function");
  });

  test("C101: getContainer() exposes the readers and the settings store", async () => {
    setEnv("https://example.supabase.co", "sb_publishable_test");
    const { getContainer } = await import("./index");
    const container = await getContainer();
    for (const name of ["pipelineBoard", "listCustomers", "customerDetail", "siteRegister", "getOrgSettings", "saveOrgSettings"] as const) {
      expect(typeof container[name], name).toBe("function");
    }
  });

  test("C340: getContainer() exposes the record stores and the edit-form reads", async () => {
    setEnv("https://example.supabase.co", "sb_publishable_test");
    const { getContainer } = await import("./index");
    const container = await getContainer();
    const names = [
      "createCustomer",
      "updateCustomer",
      "createContact",
      "updateContact",
      "deleteContact",
      "createSite",
      "updateSite",
      "createAsset",
      "updateAsset",
      "listAssetTypes",
      "contactForEdit",
      "assetForEdit",
    ] as const;
    for (const name of names) expect(typeof container[name], name).toBe("function");
  });

  test("C1280: assets are never deleted; the container exposes the three status writers instead", async () => {
    setEnv("https://example.supabase.co", "sb_publishable_test");
    const { getContainer } = await import("./index");
    const container = await getContainer();
    expect("deleteAsset" in container).toBe(false);
    for (const name of ["setCustomerActive", "setSiteActive", "setAssetActive"] as const) {
      expect(typeof container[name], name).toBe("function");
    }
    const records = await import("@/app/(app)/record-actions");
    expect("deleteAssetAction" in records).toBe(false);
    const { supabaseAssetStore } = await import("@/infrastructure/supabase/records");
    expect("delete" in supabaseAssetStore({} as never)).toBe(false);
  });

  test("C433: getContainer() exposes the import job store and read", async () => {
    setEnv("https://example.supabase.co", "sb_publishable_test");
    const { getContainer } = await import("./index");
    const container = await getContainer();
    for (const name of ["startImport", "confirmImportUpload", "discardImport", "listImportJobs"] as const) {
      expect(typeof container[name], name).toBe("function");
    }
  });

  test("C1396: getContainer() exposes listImportHistory", async () => {
    setEnv("https://example.supabase.co", "sb_publishable_test");
    const { getContainer } = await import("./index");
    expect(typeof (await getContainer()).listImportHistory).toBe("function");
  });

  test("C1412: getContainer() exposes listTaskLibrary and saveTaskLibraryType", async () => {
    setEnv("https://example.supabase.co", "sb_publishable_test");
    const { getContainer } = await import("./index");
    const container = await getContainer();
    for (const name of ["listTaskLibrary", "saveTaskLibraryType"] as const) expect(typeof container[name], name).toBe("function");
  });

  test("C433: the ports export ImportJobStore with start, confirmUploaded and discard", () => {
    const ports = readFileSync(path.join(import.meta.dirname, "../application/ports/index.ts"), "utf8");
    const body = ports.match(/export interface ImportJobStore \{([\s\S]*?)\n\}/)?.[1] ?? "";
    expect(body).toContain("start(orgId: string, siteId: string, file: ImportFile)");
    expect(body).toContain("confirmUploaded(jobId: string)");
    expect(body).toContain("discard(jobId: string)");
  });

  // Deactivation door 2 supersedes the asset half of C340: assets are never deleted (C1280).
  test("C340: the ports declare one store per entity, and delete only on contacts", () => {
    const ports = readFileSync(path.join(import.meta.dirname, "../application/ports/index.ts"), "utf8");
    const body = (name: string) => ports.match(new RegExp(String.raw`export interface ${name} \{([\s\S]*?)\n\}`))?.[1] ?? "";
    for (const name of ["CustomerStore", "ContactStore", "SiteStore", "AssetStore"]) expect(body(name), name).toContain("create(");
    expect(body("ContactStore")).toContain("delete(id: string)");
    expect(body("AssetStore")).not.toContain("delete(");
    expect(body("CustomerStore")).not.toContain("delete(");
    expect(body("SiteStore")).not.toContain("delete(");
  });

  test("C491: getContainer() returns readImport", async () => {
    setEnv("https://example.supabase.co", "sb_publishable_test");
    const { getContainer } = await import("./index");
    const container = await getContainer();
    expect(typeof container.readImport).toBe("function");
  });

  test("C483: readImport is built on the request's import job store, from the one Supabase client", () => {
    const source = readFileSync(path.join(__dirname, "index.ts"), "utf8");
    expect(source).toMatch(/const importJobs = supabaseImportJobStore\(supabase, /);
    expect(source).toContain("readImport: makeReadImport(importJobs, importParser)");
    expect(source.match(/createServerClient</g)).toHaveLength(1);
  });

  test("C555: getContainer() returns extractImport", async () => {
    setEnv("https://example.supabase.co", "sb_publishable_test");
    const { getContainer } = await import("./index");
    const container = await getContainer();
    expect(typeof container.extractImport).toBe("function");
  });

  test("C537: extractImport is built on the request's import job store and catalog, from the one Supabase client", () => {
    const source = readFileSync(path.join(__dirname, "index.ts"), "utf8");
    expect(source).toMatch(/const importJobs = supabaseImportJobStore\(supabase, /);
    expect(source).toMatch(/extractImport: makeExtractImport\(importJobs, importParser, .*supabaseAssetTypeCatalog\(supabase\)\)/);
    expect(source.match(/createServerClient</g)).toHaveLength(1);
  });

  test("C551: the ports declare AssetExtractor, ExtractChunk, ExtractedRow and the store's sourceOf and recordExtraction", () => {
    const ports = readFileSync(path.join(import.meta.dirname, "../application/ports/index.ts"), "utf8");
    const body = (name: string) => ports.match(new RegExp(String.raw`export interface ${name} \{([\s\S]*?)\n\}`))?.[1] ?? "";
    expect(body("AssetExtractor")).toContain("extract(chunk: ExtractChunk)");
    const chunk = ports.match(/export type ExtractChunk =([\s\S]*?);\r?\n/)?.[1] ?? "";
    for (const kind of ['kind: "rows"', 'kind: "text"', 'kind: "pdf"']) expect(chunk).toContain(kind);
    const extractedRow = ports.match(/export type ExtractedRow = \{([\s\S]*?)\r?\n\};/)?.[1] ?? "";
    for (const field of ["assetTypeRaw:", "unitNo:", "typeModel:", "location:", "confidence:", "sourceRef:"]) expect(extractedRow).toContain(field);
    expect(body("ImportJobStore")).toContain("sourceOf(jobId: string)");
    expect(body("ImportJobStore")).toContain("recordExtraction(jobId: string, expectedCursor: number | null, total: number, rows: ImportRowInput[])");
    const status = ports.match(/export type ImportJobStatus =([^;]*);/)?.[1] ?? "";
    expect(status).toContain('"extracting"');
    expect(status).toContain('"extracted"');
  });

  test("C490: the ports declare ImportParser, ParsedImport, ParsedTable and the store's fileOf and recordRead", () => {
    const ports = readFileSync(path.join(import.meta.dirname, "../application/ports/index.ts"), "utf8");
    const body = (name: string) => ports.match(new RegExp(String.raw`export interface ${name} \{([\s\S]*?)\n\}`))?.[1] ?? "";
    expect(body("ImportParser")).toContain("parse(contentType: ImportContentType, bytes: Uint8Array)");
    const parsedImport = ports.match(/^export type ParsedImport = (.*);$/m)?.[1] ?? "";
    expect(parsedImport).toContain('format: "table"');
    expect(parsedImport).toContain('format: "pdf"');
    const parsedTable = ports.match(/export type ParsedTable = \{([\s\S]*?)\n\};/)?.[1] ?? "";
    for (const field of ["source:", "header:", "rows:"]) expect(parsedTable).toContain(field);
    expect(body("ImportJobStore")).toContain("fileOf(jobId: string)");
    expect(body("ImportJobStore")).toContain("recordRead(jobId: string, outcome: ReadOutcome)");
  });

  test.each([
    [URL_KEY, undefined, "sb_publishable_test"],
    [PUBLISHABLE_KEY, "https://example.supabase.co", undefined],
  ])("C23: getContainer() names %s when it is unset", async (missing, url, key) => {
    setEnv(url, key);
    const { getContainer } = await import("./index");
    await expect(getContainer()).rejects.toThrow(missing);
  });

  test("C652: getContainer() returns the review reader, the row writes and commitImport", async () => {
    setEnv("https://example.supabase.co", "sb_publishable_test");
    const { getContainer } = await import("./index");
    const container = await getContainer();
    for (const name of ["reviewImport", "updateImportRow", "skipImportRow", "mapImportType", "commitImport"] as const) {
      expect(typeof container[name], name).toBe("function");
    }
  });

  test("C641: the review reader, the row store and the job store share the request's one Supabase client", () => {
    const source = readFileSync(path.join(__dirname, "index.ts"), "utf8");
    expect(source).toMatch(/const importJobs = supabaseImportJobStore\(supabase, /);
    expect(source).toMatch(/const importRows = supabaseImportRowStore\(supabase\);/);
    expect(source).toMatch(/reviewImport: supabaseImportReviewReader\(supabase\)\.forJob,/);
    expect(source).toMatch(/commitImport: importJobs\.commit,/);
    expect(source.match(/createServerClient</g)).toHaveLength(1);
  });

  test("C649: the ports declare the review reader, the row store, commit and the committed status", () => {
    const ports = readFileSync(path.join(import.meta.dirname, "../application/ports/index.ts"), "utf8");
    const body = (name: string) => ports.match(new RegExp(String.raw`export interface ${name} \{([\s\S]*?)\n\}`))?.[1] ?? "";
    expect(body("ImportReviewReader")).toContain("forJob(jobId: string)");
    for (const method of ["update(rowId: string", "setSkipped(rowId: string", "mapType(jobId: string"]) expect(body("ImportRowStore")).toContain(method);
    expect(body("ImportJobStore")).toContain("commit(jobId: string)");
    const row = ports.match(/export type ImportRowView = \{([\s\S]*?)\r?\n\};/)?.[1] ?? "";
    for (const field of ["skipped:", "assetId:"]) expect(row).toContain(field);
    expect(ports.match(/export type ImportJobStatus =([^;]*);/)?.[1] ?? "").toContain('"committed"');
  });

  test("C749: getContainer() exposes agreementReader, agreementStore and serviceLineStore", async () => {
    setEnv("https://example.supabase.co", "sb_publishable_test");
    const { getContainer } = await import("./index");
    const container = await getContainer();
    expect(typeof container.agreementReader.get).toBe("function");
    expect(typeof container.agreementStore.create).toBe("function");
    for (const method of ["add", "update", "remove"] as const) expect(typeof container.serviceLineStore[method], method).toBe("function");
  });

  test("C874: getContainer() exposes the documentRenderer adapter", async () => {
    setEnv("https://example.supabase.co", "sb_publishable_test");
    const { getContainer } = await import("./index");
    const container = await getContainer();
    expect(typeof container.documentRenderer.renderAgreement).toBe("function");
    expect(readFileSync(path.join(__dirname, "index.ts"), "utf8")).toMatch(/documentRenderer: reactPdfDocumentRenderer,/);
  });

  test("C745: the agreement adapters are built from the request's one member client", () => {
    const source = readFileSync(path.join(__dirname, "index.ts"), "utf8");
    expect(source).toMatch(/agreementReader: supabaseAgreementReader\(supabase\),/);
    expect(source).toMatch(/agreementStore: supabaseAgreementStore\(supabase\),/);
    expect(source).toMatch(/serviceLineStore: supabaseServiceLineStore\(supabase\),/);
    expect(source.match(/createServerClient</g)).toHaveLength(1);
  });

  test("C748: door 7's literal result shapes are assignable to the ports", async () => {
    const detail: AgreementDetail = {
      id: "g1",
      number: "AG-1052",
      status: "draft",
      stage: "in_progress",
      site: { id: "s1", name: "Site" },
      customer: { id: "c1", name: "Customer" },
      versions: [{ versionNo: 1, createdAt: new Date(0), reason: null, author: null, events: [] }], sentVersion: null, acceptedVersion: null, compare: null,
      shown: {
        versionNo: 1,
        current: true,
        lines: [{ id: "l1", position: 0, description: "PM", visitsPerYear: 4, costPerVisitCents: 89250, annualCents: 357000, visitMonths: [3, 6, 9, 12], equipment: [{ id: "t-rtu", code: "RTU", name: "Rooftop unit" }] }],
        annualCents: 357000,
      },
      editable: true,
      equipmentChoices: [],
      serviceScope: { source: "live", takenAt: null, types: [] },
      terms: null,
      validUntil: null,
      portalLink: null,
      linkEmail: null,
      renews: null,
      renewedBy: null,
      term: { start: null, months: 12, end: null },
    };
    const reader: AgreementReader = { get: async () => detail };
    const created: CreateAgreementResult[] = [
      { ok: true, id: "g1" },
      { ok: false, code: "forbidden" },
      { ok: false, code: "not_found" },
      { ok: false, code: "unavailable" },
      { ok: false, code: "open_exists", agreementId: "g0", number: "AG-1048" },
    ];
    const store: AgreementStore = { create: async () => created[0] };
    const added: AddServiceLineResult[] = [{ ok: true, id: "l1" }, { ok: false, code: "locked" }, { ok: false, code: "too_many" }];
    const written: ServiceLineWriteResult[] = [{ ok: true }, { ok: false, code: "locked" }, { ok: false, code: "not_found" }];
    const lines: ServiceLineStore = { add: async () => added[0], update: async () => written[0], remove: async () => written[0] };
    const live: SiteView["liveAgreement"][] = [{ id: "g1", number: "AG-1048", status: "sent" }, null];
    expect(await reader.get("g1")).toBe(detail);
    expect(await store.create("s1")).toEqual({ ok: true, id: "g1" });
    expect(await lines.add("g1", { description: "PM", visitMonths: [3, 6, 9, 12], costPerVisitCents: 0, assetTypeIds: ["t-rtu"] })).toEqual({ ok: true, id: "l1" });
    expect(live).toHaveLength(2);

    const ports = readFileSync(path.join(import.meta.dirname, "../application/ports/index.ts"), "utf8");
    const body = (name: string) => ports.match(new RegExp(String.raw`export interface ${name} \{([\s\S]*?)\n\}`))?.[1] ?? "";
    expect(body("AgreementReader")).toContain("get(id: string, versionNo?: number, compareNo?: number): Promise<AgreementDetail | null>");
    expect(body("AgreementStore")).toContain("create(siteId: string): Promise<CreateAgreementResult>");
    for (const method of ["add(agreementId: string, value: ServiceLineValue)", "update(lineId: string, value: ServiceLineValue)", "remove(lineId: string)"]) {
      expect(body("ServiceLineStore")).toContain(method);
    }
  });
});
