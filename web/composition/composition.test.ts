import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ getAll: () => [], set: () => {} }),
}));
vi.mock("next/server", () => ({ connection: async () => {} }));

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
      "deleteAsset",
      "listAssetTypes",
      "contactForEdit",
      "assetForEdit",
    ] as const;
    for (const name of names) expect(typeof container[name], name).toBe("function");
  });

  test("C433: getContainer() exposes the import job store and read", async () => {
    setEnv("https://example.supabase.co", "sb_publishable_test");
    const { getContainer } = await import("./index");
    const container = await getContainer();
    for (const name of ["startImport", "confirmImportUpload", "discardImport", "listImportJobs"] as const) {
      expect(typeof container[name], name).toBe("function");
    }
  });

  test("C433: the ports export ImportJobStore with start, confirmUploaded and discard", () => {
    const ports = readFileSync(path.join(import.meta.dirname, "../application/ports/index.ts"), "utf8");
    const body = ports.match(/export interface ImportJobStore \{([\s\S]*?)\n\}/)?.[1] ?? "";
    expect(body).toContain("start(orgId: string, siteId: string, file: ImportFile)");
    expect(body).toContain("confirmUploaded(jobId: string)");
    expect(body).toContain("discard(jobId: string)");
  });

  test("C340: the ports declare one store per entity, and delete only on contacts and assets", () => {
    const ports = readFileSync(path.join(import.meta.dirname, "../application/ports/index.ts"), "utf8");
    const body = (name: string) => ports.match(new RegExp(String.raw`export interface ${name} \{([\s\S]*?)\n\}`))?.[1] ?? "";
    for (const name of ["CustomerStore", "ContactStore", "SiteStore", "AssetStore"]) expect(body(name), name).toContain("create(");
    expect(body("ContactStore")).toContain("delete(id: string)");
    expect(body("AssetStore")).toContain("delete(id: string)");
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
});
