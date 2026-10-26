import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import type { ImportJobView } from "@/application/ports";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }), usePathname: () => "/sites/s1/import" }));

const { ImportPageView } = await import("./import-page-view");
const { ImportUploadFields } = await import("./import-upload");
const { ImportJobList } = await import("./job-list");
const { DiscardPrompt } = await import("./discard-control");
const { uploadFile } = await import("./state");

const html = (node: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(node).replace(/&#x27;/g, "'").replace(/&quot;/g, '"');

const SITE = { id: "s1", name: "Harbourview Towers" };
const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const job = (patch: Partial<ImportJobView> = {}): ImportJobView => ({
  id: "j1",
  originalName: "Units.xlsx",
  sizeBytes: 15_360,
  status: "uploaded",
  uploadedBy: "dana@example.com",
  createdAt: new Date("2026-10-26T18:00:00Z"),
  ...patch,
});

const actions = {
  start: vi.fn(),
  confirm: vi.fn(),
  discard: () => vi.fn(),
};

const writerView = (jobs: ImportJobView[] = []) => html(createElement(ImportPageView, { site: SITE, jobs, actions }));
const viewerView = (jobs: ImportJobView[] = []) => html(createElement(ImportPageView, { site: SITE, jobs }));
const fields = (state: Parameters<typeof ImportUploadFields>[0]["state"], fileName: string | null = null) =>
  html(createElement(ImportUploadFields, { state, fileName }));

describe("ImportPageView", () => {
  test("C402: a writer sees the site name, the back link, the picker, the hint and Upload", () => {
    const out = writerView();
    expect(out).toMatch(/<h1[^>]*>Harbourview Towers<\/h1>/);
    expect(out).toMatch(/<a[^>]*href="\/sites\/s1"/);
    const input = out.match(/<input[^>]*type="file"[^>]*>/)?.[0] ?? "";
    expect(input).toContain('accept=".xlsx,.csv,.docx,.pdf"');
    expect(out).toContain("Excel, CSV, Word or PDF, up to 20 MB");
    expect(out).toMatch(/<button[^>]*type="submit"[^>]*>Upload<\/button>/);
  });

  test("C410: jobs are listed in the order the port returns them", () => {
    const out = writerView([job({ id: "j2", originalName: "newer.pdf" }), job({ id: "j1", originalName: "older.csv" })]);
    expect(out.indexOf("newer.pdf")).toBeLessThan(out.indexOf("older.csv"));
  });

  test("C424: a viewer sees the jobs, and no picker, Upload or Discard", () => {
    const out = viewerView([job()]);
    expect(out).toContain("Units.xlsx");
    expect(out).not.toContain('type="file"');
    expect(out).not.toContain(">Upload<");
    expect(out).not.toContain(">Discard<");
  });
});

describe("ImportUploadFields", () => {
  test("C409: while uploading, Upload is disabled and reads Uploading…, and the file name stays", () => {
    const out = fields({ status: "uploading" }, "Units.xlsx");
    expect(out).toMatch(/<button[^>]*type="submit"[^>]*disabled=""[^>]*>Uploading…<\/button>/);
    expect(out).toContain("Units.xlsx");
  });

  test("C416: upload_failed shows the message and keeps the chosen file name", () => {
    const out = fields({ status: "upload_failed" }, "Units.xlsx");
    expect(out).toContain("The upload didn't finish. Try again.");
    expect(out).toContain("Units.xlsx");
  });

  test("C425: forbidden shows the permission message", () => {
    expect(fields({ status: "forbidden" })).toContain("You don't have permission to import equipment lists.");
  });

  test("C431: unavailable shows the retry message", () => {
    expect(fields({ status: "unavailable" })).toContain("We couldn't upload the file. Try again.");
  });
});

describe("uploadFile", () => {
  const started = { status: "started" as const, jobId: "job-1", signedUrl: "https://example.supabase.co/sign?token=t", contentType: "text/csv" as const };

  test("C408: PUTs the bytes with the server's content type and x-upsert false, never File.type", async () => {
    const file = new File(["a,b"], "units.csv", { type: "application/vnd.ms-excel" });
    const fetch = vi.fn<typeof globalThis.fetch>(async () => new Response(null, { status: 200 }));
    const start = vi.fn(async (_form: FormData) => started);
    const confirm = vi.fn(async () => ({ status: "uploaded" as const }));

    expect(await uploadFile(file, { start, confirm, fetch })).toEqual({ status: "uploaded" });

    const sent = start.mock.calls[0][0];
    expect(sent.get("fileName")).toBe("units.csv");
    expect(sent.get("size")).toBe("3");
    expect(fetch).toHaveBeenCalledWith(started.signedUrl, {
      method: "PUT",
      body: file,
      headers: { "content-type": "text/csv", "x-upsert": "false" },
    });
    expect(confirm).toHaveBeenCalledWith("job-1");
  });

  test.each([
    ["the PUT answers 403", () => Promise.resolve(new Response(null, { status: 403 }))],
    ["the PUT rejects", () => Promise.reject(new TypeError("network"))],
  ])("C416: %s -> upload_failed, never confirmed", async (_name, put) => {
    const confirm = vi.fn();
    const result = await uploadFile(new File(["x"], "a.pdf"), { start: async () => started, confirm, fetch: vi.fn(put) });
    expect(result).toEqual({ status: "upload_failed" });
    expect(confirm).not.toHaveBeenCalled();
  });

  test("C416: confirm answering upload_missing -> upload_failed", async () => {
    const result = await uploadFile(new File(["x"], "a.pdf"), {
      start: async () => started,
      confirm: async () => ({ status: "upload_missing" }),
      fetch: async () => new Response(null, { status: 200 }),
    });
    expect(result).toEqual({ status: "upload_failed" });
  });

  test("C412: a refused start is returned as is, with no PUT", async () => {
    const fetch = vi.fn();
    const result = await uploadFile(new File(["x"], "a.txt"), {
      start: async () => ({ status: "invalid", message: "Choose an Excel (.xlsx), CSV, Word (.docx) or PDF file" }),
      confirm: vi.fn(),
      fetch,
    });
    expect(result).toEqual({ status: "invalid", message: "Choose an Excel (.xlsx), CSV, Word (.docx) or PDF file" });
    expect(fetch).not.toHaveBeenCalled();
  });

  test("C408: an xlsx is sent with the xlsx type the server returned", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => new Response(null, { status: 200 }));
    await uploadFile(new File(["x"], "u.xlsx", { type: "" }), {
      start: async () => ({ ...started, contentType: XLSX }),
      confirm: async () => ({ status: "uploaded" }),
      fetch,
    });
    expect(fetch.mock.calls[0][1]).toMatchObject({ headers: { "content-type": XLSX } });
  });
});

describe("ImportJobList", () => {
  test("C418: each job shows name, size, uploader, date and status label", () => {
    const out = html(
      createElement(ImportJobList, {
        jobs: [
          job({ id: "a", originalName: "a.csv", sizeBytes: 512, status: "uploaded" }),
          job({ id: "b", originalName: "b.pdf", sizeBytes: 1_048_576, status: "uploading", uploadedBy: null }),
          job({ id: "c", originalName: "c.docx", sizeBytes: 15_360 }),
          job({ id: "d", originalName: "d.pdf", sizeBytes: 20_971_520 }),
        ],
      }),
    );
    for (const text of ["a.csv", "1 KB", "1.0 MB", "15 KB", "20.0 MB", "dana@example.com", "Former member", "Oct 26, 2026", "Uploaded", "Upload not finished"]) {
      expect(out, text).toContain(text);
    }
  });

  test("C419: no jobs -> No equipment lists imported yet", () => {
    expect(html(createElement(ImportJobList, { jobs: [] }))).toContain("No equipment lists imported yet");
  });
});

describe("DiscardPrompt", () => {
  test("C420: unconfirmed shows only a Discard button, no prompt and no form", () => {
    const out = html(createElement(DiscardPrompt, { name: "Units.xlsx", confirming: false, pending: false, state: { status: "idle" } }));
    expect(out).toMatch(/<button[^>]*type="button"[^>]*>Discard<\/button>/);
    expect(out).not.toContain("The file will be deleted.");
    expect(out).not.toContain("<form");
  });

  test("C420: confirming shows the prompt, and only Discard submits the form", () => {
    const out = html(createElement(DiscardPrompt, { name: "Units.xlsx", confirming: true, pending: false, state: { status: "idle" } }));
    expect(out).toContain("Discard Units.xlsx? The file will be deleted.");
    expect(out).toMatch(/<button[^>]*type="submit"[^>]*>Discard<\/button>/);
    expect(out).toMatch(/<button[^>]*type="button"[^>]*>Cancel<\/button>/);
    expect(out.match(/type="submit"/g)).toHaveLength(1);
  });
});
