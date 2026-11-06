import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { SignatureRequestInput } from "@/application/ports";
import { docusealSignatureProvider } from "./index";

const KEY = "test-key-0123456789";
const URL_BASE = "https://api.docuseal.com";

const input: SignatureRequestInput = {
  contractId: "c0ffee00-0000-4000-8000-000000000001",
  number: "AG-1052",
  pdf: new Uint8Array([1, 2, 3]),
  signers: [
    { role: "customer", name: "Pat Lee", email: "pat@example.com" },
    { role: "contractor", name: "Dana Admin", email: "dana@example.com" },
  ],
};

const GOOD = {
  id: 13226499,
  submitters: [
    { id: 17214316, role: "Customer", embed_src: "https://docuseal.com/s/a" },
    { id: 17214317, role: "Contractor", embed_src: "https://docuseal.com/s/b" },
  ],
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

function provider(fetchImpl: typeof fetch, overrides: { apiKey?: string | undefined; apiUrl?: string | undefined } = {}) {
  const config = { apiKey: KEY, apiUrl: URL_BASE, ...overrides };
  return docusealSignatureProvider({ ...config, fetch: fetchImpl });
}

let errors: unknown[][];
beforeEach(() => {
  errors = [];
  vi.spyOn(console, "error").mockImplementation((...args) => {
    errors.push(args);
  });
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("DocuSeal adapter: createRequest", () => {
  test("C1652: posts the contract to /submissions/pdf with both submitters, customer first", async () => {
    const fetchImpl = vi.fn(async () => json(GOOD));
    await provider(fetchImpl as unknown as typeof fetch, { apiUrl: `${URL_BASE}/` }).createRequest(input);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.docuseal.com/submissions/pdf");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["X-Auth-Token"]).toBe(KEY);
    expect(JSON.parse(init.body as string)).toEqual({
      order: "preserved",
      send_email: false,
      remove_tags: true,
      documents: [{ name: "AG-1052-contract.pdf", file: "AQID" }],
      submitters: [
        { role: "Customer", name: "Pat Lee", email: "pat@example.com", external_id: `${input.contractId}:customer` },
        { role: "Contractor", name: "Dana Admin", email: "dana@example.com", external_id: `${input.contractId}:contractor` },
      ],
    });
  });

  test("C1653: answers the submission and each signer's id and embed link, whatever the order of the submitters", async () => {
    const expected = {
      ok: true,
      submissionId: "13226499",
      signers: [
        { role: "customer", submitterId: "17214316", embedSrc: "https://docuseal.com/s/a" },
        { role: "contractor", submitterId: "17214317", embedSrc: "https://docuseal.com/s/b" },
      ],
    };
    expect(await provider((async () => json(GOOD)) as unknown as typeof fetch).createRequest(input)).toEqual(expected);
    const reversed = { ...GOOD, submitters: [...GOOD.submitters].reverse() };
    expect(await provider((async () => json(reversed)) as unknown as typeof fetch).createRequest(input)).toEqual(expected);
  });

  test.each([400, 401, 403, 404, 422])("C1654: an answer of %i is rejected", async (status) => {
    const result = await provider((async () => json({ error: "no" }, status)) as unknown as typeof fetch).createRequest(input);
    expect(result).toEqual({ ok: false, code: "rejected" });
  });

  test.each([429, 500, 502, 503])("C1655: an answer of %i is unavailable", async (status) => {
    const result = await provider((async () => json({}, status)) as unknown as typeof fetch).createRequest(input);
    expect(result).toEqual({ ok: false, code: "unavailable" });
  });

  test("C1655: a network error is unavailable", async () => {
    const result = await provider((async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch).createRequest(input);
    expect(result).toEqual({ ok: false, code: "unavailable" });
  });

  test("C1655: no answer after 30 000 ms aborts the request and is unavailable", async () => {
    vi.useFakeTimers();
    let aborted = false;
    const fetchImpl = ((_url: string, init: RequestInit) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => {
          aborted = true;
          reject(new DOMException("aborted", "AbortError"));
        });
      })) as unknown as typeof fetch;
    const pending = provider(fetchImpl).createRequest(input);
    await vi.advanceTimersByTimeAsync(29_999);
    expect(aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(aborted).toBe(true);
    expect(await pending).toEqual({ ok: false, code: "unavailable" });
  });

  test("C1656: a 4xx and a 5xx log one line with neither the key nor the PDF", async () => {
    const big = { ...input, pdf: new TextEncoder().encode("%PDF-1.7 SECRET-CONTRACT-BYTES ".repeat(20)) };
    const base64 = Buffer.from(big.pdf).toString("base64");
    for (const status of [422, 503]) {
      errors.length = 0;
      // The provider echoes the request in its error body, which must not reach the log either.
      await provider((async () => json({ error: `bad ${KEY} ${base64}` }, status)) as unknown as typeof fetch).createRequest(big);
      expect(errors).toHaveLength(1);
      const line = JSON.stringify(errors[0]);
      expect(line).not.toContain(KEY);
      expect(line).not.toContain(base64.slice(0, 40));
    }
  });

  test.each([
    ["key", { apiKey: undefined }],
    ["url", { apiUrl: undefined }],
    ["key and url", { apiKey: undefined, apiUrl: undefined }],
  ])("C1657: with the %s unset createRequest is not_configured and nothing is sent", async (_name, overrides) => {
    const fetchImpl = vi.fn();
    expect(await provider(fetchImpl as unknown as typeof fetch, overrides).createRequest(input)).toEqual({ ok: false, code: "not_configured" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test.each([
    ["no id", { submitters: GOOD.submitters }],
    ["no contractor submitter", { id: 1, submitters: [GOOD.submitters[0]] }],
    ["a submitter with no id", { id: 1, submitters: [{ role: "Customer", embed_src: "https://docuseal.com/s/a" }, GOOD.submitters[1]] }],
    ["an empty embed_src", { id: 1, submitters: [GOOD.submitters[0], { ...GOOD.submitters[1], embed_src: "" }] }],
  ])("C1659: an answer with %s is unavailable", async (_name, body) => {
    const result = await provider((async () => json(body)) as unknown as typeof fetch).createRequest(input);
    expect(result).toEqual({ ok: false, code: "unavailable" });
  });
});

describe("DocuSeal adapter: void", () => {
  test("C1658: deletes the submission and answers ok on 200", async () => {
    const fetchImpl = vi.fn(async () => json({ id: 13226499, archived_at: "2026-11-06T00:00:00Z" }));
    expect(await provider(fetchImpl as unknown as typeof fetch).void("13226499")).toEqual({ ok: true });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.docuseal.com/submissions/13226499");
    expect(init.method).toBe("DELETE");
    expect((init.headers as Record<string, string>)["X-Auth-Token"]).toBe(KEY);
  });

  test("C1658: 404 is rejected, 500 and a network error are unavailable, and none throws", async () => {
    expect(await provider((async () => json({}, 404)) as unknown as typeof fetch).void("1")).toEqual({ ok: false, code: "rejected" });
    expect(await provider((async () => json({}, 500)) as unknown as typeof fetch).void("1")).toEqual({ ok: false, code: "unavailable" });
    const failing = (async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;
    expect(await provider(failing).void("1")).toEqual({ ok: false, code: "unavailable" });
  });

  test("C1657: with the key unset void is not_configured and nothing is sent", async () => {
    const fetchImpl = vi.fn();
    expect(await provider(fetchImpl as unknown as typeof fetch, { apiKey: undefined }).void("1")).toEqual({ ok: false, code: "not_configured" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
