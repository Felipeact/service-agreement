import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { docusealSignedDocuments } from "./signed-documents";

const SIGNED_URL = "https://docuseal.com/file/a/document.pdf";
const AUDIT_URL = "https://cdn.docuseal.com/file/b/audit-log.pdf";
const DOCS = [
  { kind: "signed" as const, url: SIGNED_URL },
  { kind: "audit_log" as const, url: AUDIT_URL },
];

const pdf = (text: string) => new TextEncoder().encode(text);
const answer = (bytes: Uint8Array | string, status = 200, headers: Record<string, string> = {}) =>
  new Response(typeof bytes === "string" ? pdf(bytes) : (bytes as BodyInit), { status, headers });

let errors: string[];

beforeEach(() => {
  errors = [];
  vi.spyOn(console, "error").mockImplementation((line: unknown) => {
    errors.push(String(line));
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const run = (fetchImpl: typeof fetch, documents = DOCS) => docusealSignedDocuments({ fetch: fetchImpl }).fetch(documents);

describe("the signed documents adapter", () => {
  test("C1748: it requests both addresses with no credentials, no redirect following and no cache", async () => {
    const calls: [string, RequestInit][] = [];
    const fetchImpl = (async (url: string, init: RequestInit) => {
      calls.push([url, init]);
      return answer("%PDF-1.4 x");
    }) as unknown as typeof fetch;
    await run(fetchImpl);
    expect(calls.map(([url]) => url)).toEqual([SIGNED_URL, AUDIT_URL]);
    for (const [, init] of calls) {
      expect(init.method).toBe("GET");
      expect(init.redirect).toBe("manual");
      expect(init.cache).toBe("no-store");
      expect(init.headers).toBeUndefined();
      expect(JSON.stringify(init)).not.toMatch(/X-Auth-Token|Authorization|Cookie/i);
    }
  });

  test.each([
    "http://docuseal.com/x",
    "https://evil-docuseal.com/x",
    "https://docuseal.com.evil.net/x",
    "https://docuseal.com@evil.net/x",
    "https://user:pw@docuseal.com/x",
    "ftp://docuseal.com/x",
    "not a url",
  ])("C1748: %s is refused without calling fetch", async (url) => {
    const fetchImpl = vi.fn();
    const result = await run(fetchImpl as unknown as typeof fetch, [{ kind: "signed", url }, DOCS[1]]);
    expect(result).toEqual({ ok: false, code: "rejected" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test.each([
    ["a redirect of 302", async () => answer("", 302, { location: "https://evil.net/x" })],
    ["an answer of 404", async () => answer("no", 404)],
    ["an answer of 500", async () => answer("no", 500)],
    [
      "a rejected fetch",
      async () => {
        throw new TypeError("fetch failed");
      },
    ],
    ["a body that is not a PDF", async () => answer("<html>sign in</html>")],
    ["a declared length over the cap", async () => answer("%PDF-1.4", 200, { "content-length": "10485761" })],
    [
      "a body streamed past the cap",
      async () => {
        const chunk = new Uint8Array(1024 * 1024).fill(97);
        chunk.set(pdf("%PDF-"));
        let sent = 0;
        return new Response(
          new ReadableStream({
            pull(controller) {
              sent += 1;
              if (sent > 12) controller.close();
              else controller.enqueue(chunk);
            },
          }),
        );
      },
    ],
  ])("C1749: %s is unavailable", async (_label, fetchImpl) => {
    expect(await run(fetchImpl as unknown as typeof fetch)).toEqual({ ok: false, code: "unavailable" });
  });

  test("C1749: no answer after 30 000 ms aborts the request and is unavailable", async () => {
    vi.useFakeTimers();
    let aborted = false;
    const fetchImpl = ((_url: string, init: RequestInit) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => {
          aborted = true;
          reject(new DOMException("aborted", "AbortError"));
        });
      })) as unknown as typeof fetch;
    const pending = run(fetchImpl);
    await vi.advanceTimersByTimeAsync(29_999);
    expect(aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(aborted).toBe(true);
    expect(await pending).toEqual({ ok: false, code: "unavailable" });
  });

  test("C1749: a body of exactly 10 485 760 bytes is accepted, and the files come back byte for byte in order", async () => {
    const limit = new Uint8Array(10 * 1024 * 1024).fill(97);
    limit.set(pdf("%PDF-"));
    const bodies = [limit, pdf("%PDF-1.4 audit")];
    let at = 0;
    const result = await run((async () => answer(bodies[at++])) as unknown as typeof fetch);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.files.map((file) => file.kind)).toEqual(["signed", "audit_log"]);
      expect(result.files[0].bytes.length).toBe(10485760);
      expect(Array.from(result.files[1].bytes)).toEqual(Array.from(pdf("%PDF-1.4 audit")));
    }
  });

  test("C1749: a single signed file comes back as {kind, bytes} with exactly the bytes served", async () => {
    const result = await run((async () => answer("%PDF-1.4 signed")) as unknown as typeof fetch, [DOCS[0]]);
    expect(result).toEqual({ ok: true, files: [{ kind: "signed", bytes: pdf("%PDF-1.4 signed") }] });
  });

  test("C1750: failures name the host and the status, never the path, the query or a byte of the body", async () => {
    const secretUrl = "https://docuseal.com/file/SECRET-PATH/d.pdf?sig=SECRET-QUERY";
    const cases: (typeof fetch)[] = [
      (async () => answer("SECRET-BODY", 404)) as unknown as typeof fetch,
      (async () => answer("SECRET-BODY", 302, { location: "https://evil.net/SECRET-PATH" })) as unknown as typeof fetch,
      (async () => {
        throw new TypeError("fetch failed SECRET-PATH");
      }) as unknown as typeof fetch,
    ];
    for (const fetchImpl of cases) {
      errors.length = 0;
      await run(fetchImpl, [{ kind: "signed", url: secretUrl }]);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain("docuseal.com");
      expect(errors[0]).not.toMatch(/SECRET-PATH|SECRET-QUERY|SECRET-BODY/);
    }
    errors.length = 0;
    await run((async () => answer("SECRET-BODY", 404)) as unknown as typeof fetch, [{ kind: "signed", url: secretUrl }]);
    expect(errors[0]).toContain("404");
  });
});
