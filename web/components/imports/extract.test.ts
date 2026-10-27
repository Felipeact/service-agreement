import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import type { ImportJobView } from "@/application/ports";
import type { ExtractState } from "./state";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }), usePathname: () => "/sites/s1/import" }));

const { ImportJobList } = await import("./job-list");
const { ExtractPrompt } = await import("./extract-control");
const { runExtraction } = await import("./state");

const html = (node: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(node).replace(/&#x27;/g, "'").replace(/&quot;/g, '"');

const job = (patch: Partial<ImportJobView> = {}): ImportJobView => ({
  id: "j1",
  originalName: "Units.xlsx",
  sizeBytes: 15_360,
  status: "parsed",
  uploadedBy: "dana@example.com",
  createdAt: new Date("2026-10-26T18:00:00Z"),
  outcome: { status: "parsed", tables: 1, rows: 48 },
  extraction: null,
  ...patch,
});

const writerList = (jobs: ImportJobView[]) => html(createElement(ImportJobList, { jobs, extract: vi.fn() }));
const viewerList = (jobs: ImportJobView[]) => html(createElement(ImportJobList, { jobs }));
const buttons = (out: string) => [...out.matchAll(/<button[^>]*>([^<]*)<\/button>/g)].map((m) => m[1]);

describe("runExtraction", () => {
  test.each<[string, ExtractState[], number, string]>([
    [
      "three chunks then the end",
      [
        { status: "extracting", done: 1, total: 4 },
        { status: "extracting", done: 2, total: 4 },
        { status: "extracting", done: 3, total: 4 },
        { status: "extracted", rows: 338, unmatched: 14 },
      ],
      4,
      "extracted",
    ],
    ["already extracted", [{ status: "extracted", rows: 1, unmatched: 0 }], 1, "extracted"],
    ["an outage after one chunk", [{ status: "extracting", done: 1, total: 4 }, { status: "unavailable" }], 2, "unavailable"],
    ["too large after one chunk", [{ status: "extracting", done: 1, total: 4 }, { status: "too_large" }], 2, "too_large"],
  ])("C501: %s", async (_name, script, calls, last) => {
    const answers = [...script];
    const extract = vi.fn(async () => answers.shift() as ExtractState);
    const onProgress = vi.fn();

    const result = await runExtraction("j1", { extract, onProgress });

    expect(extract).toHaveBeenCalledTimes(calls);
    expect(extract).toHaveBeenCalledWith("j1");
    expect(result.status).toBe(last);
    const progressed = script.filter((answer) => answer.status === "extracting");
    expect(onProgress).toHaveBeenCalledTimes(progressed.length);
    if (progressed[0]) expect(onProgress).toHaveBeenNthCalledWith(1, { done: 1, total: 4 });
  });
});

describe("the job list during and after extraction", () => {
  test("C522: an extracting job shows the pill, the progress and, for a writer only, Continue extraction", () => {
    const extracting = job({ status: "extracting", extraction: { status: "extracting", cursor: 2, total: 4 } });

    const writer = writerList([extracting]);
    expect(writer).toContain("Extracting");
    expect(writer).toContain("2 of 4");
    expect(buttons(writer)).toContain("Continue extraction");

    const viewer = viewerList([extracting]);
    expect(viewer).toContain("Extracting");
    expect(viewer).toContain("2 of 4");
    expect(buttons(viewer)).not.toContain("Continue extraction");
  });

  test("C541: a parsed job shows the Read pill and Extract equipment for a writer, and no button for a viewer", () => {
    const writer = writerList([job()]);
    expect(writer).toContain("Read");
    expect(buttons(writer)).toContain("Extract equipment");

    const viewer = viewerList([job()]);
    expect(viewer).toContain("Read");
    expect(buttons(viewer)).not.toContain("Extract equipment");
  });

  test.each<[number, number, string]>([
    [338, 14, "338 rows, 14 need an equipment type"],
    [338, 0, "338 rows"],
    [1, 0, "1 row"],
    [5, 1, "5 rows, 1 needs an equipment type"],
    [0, 0, "No equipment found"],
  ])("C543: %i rows with %i unmatched read %j", (rows, unmatched, line) => {
    const out = viewerList([job({ status: "extracted", extraction: { status: "extracted", rows, unmatched } })]);

    expect(out).toMatch(/<span data-tone="neutral"[^>]*>Extracted<\/span>/);
    expect(out).toContain(`>${line}<`);
  });
});

describe("ExtractPrompt", () => {
  test("C542: idle, pending and pending with progress", () => {
    const idle = html(createElement(ExtractPrompt, { pending: false, progress: null, state: { status: "idle" } }));
    expect(idle).toMatch(/<button[^>]*type="submit"[^>]*>Extract equipment<\/button>/);
    expect(idle).not.toContain('disabled=""');

    const pending = html(createElement(ExtractPrompt, { pending: true, progress: null, state: { status: "idle" } }));
    expect(pending).toMatch(/<button[^>]*disabled=""[^>]*>Extracting…<\/button>/);

    const progressed = html(createElement(ExtractPrompt, { pending: true, progress: { done: 2, total: 4 }, state: { status: "idle" } }));
    expect(progressed).toMatch(/<button[^>]*disabled=""[^>]*>Extracting… 2 of 4<\/button>/);
  });

  test.each<[string, string]>([
    ["unavailable", "We couldn't read this list. Try again."],
    ["too_large", "This document lists more equipment than can be read at once. Split it and upload each part."],
    ["not_ready", "The upload didn't finish. Try again."],
    ["forbidden", "You don't have permission to import equipment lists."],
    ["not_found", "This import no longer exists."],
  ])("C544: %s shows its message in an alert and leaves the button enabled", (status, message) => {
    const out = html(createElement(ExtractPrompt, { pending: false, progress: null, state: { status } as ExtractState }));

    expect(out).toMatch(/<p[^>]*role="alert"[^>]*>/);
    expect(out).toContain(message);
    expect(out).not.toContain('disabled=""');
  });
});
