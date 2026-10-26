import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import type { ImportJobView } from "@/application/ports";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }), usePathname: () => "/sites/s1/import" }));

const { ImportPageView } = await import("./import-page-view");
const { ImportUploadFields } = await import("./import-upload");
const { ImportJobList } = await import("./job-list");
const { DiscardPrompt } = await import("./discard-control");
const { uploadFile, uploadMessage } = await import("./state");
const { ReadFilePrompt } = await import("./read-file-control");

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
  outcome: null,
  ...patch,
});

const actions = {
  start: vi.fn(),
  confirm: vi.fn(),
  discard: () => vi.fn(),
  read: vi.fn(),
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
    const start = vi.fn<(form: FormData) => Promise<typeof started>>(async () => started);
    const confirm = vi.fn(async () => ({ status: "uploaded" as const }));
    const read = vi.fn(async () => ({ status: "parsed" as const, tables: 1, rows: 1 }));

    // Since import-parse AC 1 the sequence ends with the read, so the result is the read's state.
    expect(await uploadFile(file, { start, confirm, read, fetch })).toEqual({ status: "parsed", tables: 1, rows: 1 });

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
    const read = vi.fn();
    const result = await uploadFile(new File(["x"], "a.pdf"), { start: async () => started, confirm, read, fetch: vi.fn(put) });
    expect(result).toEqual({ status: "upload_failed" });
    expect(confirm).not.toHaveBeenCalled();
    expect(read).not.toHaveBeenCalled();
  });

  test("C416: confirm answering upload_missing -> upload_failed", async () => {
    const result = await uploadFile(new File(["x"], "a.pdf"), {
      start: async () => started,
      confirm: async () => ({ status: "upload_missing" }),
      read: vi.fn(),
      fetch: async () => new Response(null, { status: 200 }),
    });
    expect(result).toEqual({ status: "upload_failed" });
  });

  test("C412: a refused start is returned as is, with no PUT", async () => {
    const fetch = vi.fn();
    const result = await uploadFile(new File(["x"], "a.txt"), {
      start: async () => ({ status: "invalid", message: "Choose an Excel (.xlsx), CSV, Word (.docx) or PDF file" }),
      confirm: vi.fn(),
      read: vi.fn(),
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
      read: async () => ({ status: "parsed", tables: 1, rows: 1 }),
      fetch,
    });
    expect(fetch.mock.calls[0][1]).toMatchObject({ headers: { "content-type": XLSX } });
  });

  test("C451: a confirmed upload is read once, after confirm, and the read's state is returned", async () => {
    const order: string[] = [];
    const confirm = vi.fn(async () => (order.push("confirm"), { status: "uploaded" as const }));
    const read = vi.fn(async () => (order.push("read"), { status: "unreadable" as const, reason: "no_table" as const }));

    const result = await uploadFile(new File(["x"], "u.csv"), { start: async () => started, confirm, read, fetch: async () => new Response(null, { status: 200 }) });

    expect(result).toEqual({ status: "unreadable", reason: "no_table" });
    expect(read).toHaveBeenCalledTimes(1);
    expect(read).toHaveBeenCalledWith("job-1");
    expect(order).toEqual(["confirm", "read"]);
  });

  test("C451: confirm answering upload_missing never reads", async () => {
    const read = vi.fn();
    await uploadFile(new File(["x"], "u.csv"), {
      start: async () => started,
      confirm: async () => ({ status: "upload_missing" }),
      read,
      fetch: async () => new Response(null, { status: 200 }),
    });
    expect(read).not.toHaveBeenCalled();
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
    const rows = out.match(/<li[\s\S]*?<\/li>/g) ?? [];
    expect(rows).toHaveLength(4);
    const expected = [
      ["a.csv", "1 KB", "dana@example.com", "Uploaded"],
      ["b.pdf", "1.0 MB", "Former member", "Upload not finished"],
      ["c.docx", "15 KB", "dana@example.com", "Uploaded"],
      ["d.pdf", "20.0 MB", "dana@example.com", "Uploaded"],
    ];
    expected.forEach((texts, index) => {
      for (const text of [...texts, "Oct 26, 2026"]) expect(rows[index], `row ${index}: ${text}`).toContain(text);
    });
    expect(rows[0]).not.toContain("Upload not finished");
  });

  test("C420: each job's Discard is bound to that job's id", () => {
    const discard = vi.fn<(jobId: string) => () => Promise<{ status: "discarded" }>>(() => vi.fn());
    html(createElement(ImportJobList, { jobs: [job({ id: "a", originalName: "a.csv" }), job({ id: "b", originalName: "b.pdf" })], discard }));
    expect(discard.mock.calls.map(([id]) => id)).toEqual(["a", "b"]);
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

describe("reading a file", () => {
  const list = (jobs: ImportJobView[], writer = true) =>
    html(createElement(ImportJobList, writer ? { jobs, discard: () => vi.fn(), read: () => vi.fn() } : { jobs }));
  const pill = (out: string) => out.match(/<span[^>]*data-tone="([a-z]+)"[^>]*>[\s\S]*?<\/span>/);

  test("C452: while reading, Upload is disabled and labelled Reading…, the picker is disabled and the file name stays", () => {
    const out = fields({ status: "reading" }, "units.xlsx");
    expect(out).toMatch(/<button[^>]*type="submit"[^>]*disabled=""[^>]*>Reading…<\/button>/);
    expect(out).toMatch(/<input[^>]*type="file"[^>]*disabled=""/);
    expect(out).toContain("units.xlsx");
  });

  test.each([
    ["corrupt", "This file is damaged or isn't the format its name says."],
    ["password_protected", "This file is password-protected or saved in an older Office format. Save it as .xlsx or .docx without a password and upload it again."],
    ["no_table", "No table with column headings was found."],
    ["no_text", "This document has no text."],
    ["too_many_rows", "This list has more than 2,000 rows. Split it and upload each part."],
  ] as const)("C472: unreadable %s shows Can't read in attention and its message", (reason, message) => {
    const out = list([job({ status: "unreadable", outcome: { status: "unreadable", reason } })]);
    expect(out).toContain("Can't read");
    expect(out).toMatch(/data-tone="attention"/);
    expect(out).toContain(message);
  });

  test("C477: a read that failed unexpectedly shows We couldn't read the file. Try again.", () => {
    expect(uploadMessage({ status: "read_failed" })).toBe("We couldn't read the file. Try again.");
    expect(html(createElement(ReadFilePrompt, { pending: false, state: { status: "unavailable" } }))).toContain("We couldn't read the file. Try again.");
  });

  test("C478: an uploaded job shows Uploaded and, for a writer, Read file; pending shows a disabled Reading…", () => {
    const out = list([job({ status: "uploaded" })]);
    expect(out).toContain("Uploaded");
    expect(out).toMatch(/<button[^>]*>Read file<\/button>/);

    const pending = html(createElement(ReadFilePrompt, { pending: true, state: { status: "idle" } }));
    expect(pending).toMatch(/<button[^>]*disabled=""[^>]*>Reading…<\/button>/);
  });

  test("C484: a viewer sees parsed and unreadable outcomes, and no Read file", () => {
    const out = list(
      [
        job({ id: "a", status: "parsed", outcome: { status: "parsed", tables: 1, rows: 48 } }),
        job({ id: "b", status: "unreadable", outcome: { status: "unreadable", reason: "no_text" } }),
        job({ id: "c", status: "uploaded" }),
      ],
      false,
    );
    expect(out).toContain("48 rows in 1 table");
    expect(out).toContain("This document has no text.");
    expect(out).toMatch(/<span data-tone="neutral"[^>]*>Read<\/span>/);
    expect(out).toMatch(/<span data-tone="attention"[^>]*>Can't read<\/span>/);
    expect(out).not.toContain("Read file");
  });

  test.each<[number | null, number | null, string]>([
    [1, 48, "48 rows in 1 table"],
    [1, 1, "1 row in 1 table"],
    [2, 15, "15 rows in 2 tables"],
    [0, 0, "Text only, no table"],
    [null, null, "PDF, read at extraction"],
  ])("C485: parsed (%s tables, %s rows) shows Read in neutral and %s", (tables, rows, line) => {
    const out = list([job({ status: "parsed", outcome: { status: "parsed", tables, rows } })]);
    expect(out).toContain(">Read<");
    expect(pill(out)?.[1]).toBe("neutral");
    expect(out).toContain(line);
    expect(out).not.toContain("Read file");
  });
});
