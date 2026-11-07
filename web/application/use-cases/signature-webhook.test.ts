import { beforeEach, describe, expect, test, vi } from "vitest";
import type { SignatureWebhooks, SignedDocuments, WebhookCallResult } from "@/application/ports";
import { makeReceiveSignatureEvent } from "./signature-webhook";

const DELIVERY = { body: '{"event_type":"submission.completed"}', signature: `1790000000.${"b".repeat(64)}` };
const URLS = [
  { kind: "signed" as const, url: "https://docuseal.com/file/a/document.pdf" },
  { kind: "audit_log" as const, url: "https://docuseal.com/file/a/audit-log.pdf" },
];
const SIGNED = new Uint8Array([1, 2, 3]);
const AUDIT = new Uint8Array([4, 5, 6]);

const receive = vi.fn<SignatureWebhooks["receive"]>();
const fetchFiles = vi.fn<SignedDocuments["fetch"]>();
const run = () => makeReceiveSignatureEvent({ receive }, { fetch: fetchFiles })(DELIVERY);

beforeEach(() => {
  vi.clearAllMocks();
  fetchFiles.mockResolvedValue({ ok: true, files: [{ kind: "signed", bytes: SIGNED }, { kind: "audit_log", bytes: AUDIT }] });
});

describe("makeReceiveSignatureEvent", () => {
  test("C1751: documents_needed fetches the two files and calls again with them in base64", async () => {
    receive.mockResolvedValueOnce({ ok: true, answer: { outcome: "documents_needed", documents: URLS } });
    receive.mockResolvedValueOnce({ ok: true, answer: { outcome: "applied" } });
    expect(await run()).toEqual({ ok: true, outcome: "applied" });
    expect(fetchFiles).toHaveBeenCalledTimes(1);
    expect(fetchFiles).toHaveBeenCalledWith(URLS);
    expect(receive).toHaveBeenCalledTimes(2);
    expect(receive).toHaveBeenNthCalledWith(1, DELIVERY);
    expect(receive).toHaveBeenNthCalledWith(2, {
      ...DELIVERY,
      documents: [
        { kind: "signed", content: "AQID" },
        { kind: "audit_log", content: "BAUG" },
      ],
    });
  });

  test.each(["rejected", "unavailable"] as const)("C1752: a fetch that gives %s is unavailable and the webhook is called once", async (code) => {
    receive.mockResolvedValueOnce({ ok: true, answer: { outcome: "documents_needed", documents: URLS } });
    fetchFiles.mockResolvedValue({ ok: false, code });
    expect(await run()).toEqual({ ok: false, code: "unavailable" });
    expect(receive).toHaveBeenCalledTimes(1);
  });

  test.each<[string, WebhookCallResult]>([
    ["unauthorized", { ok: false, code: "unauthorized" }],
    ["malformed", { ok: false, code: "malformed" }],
  ])("C1752: %s from the first call is returned with no fetch", async (_label, result) => {
    receive.mockResolvedValueOnce(result);
    expect(await run()).toEqual(result);
    expect(fetchFiles).not.toHaveBeenCalled();
  });

  test.each<[string, WebhookCallResult, unknown]>([
    ["applied", { ok: true, answer: { outcome: "applied" } }, { ok: true, outcome: "applied" }],
    ["duplicate", { ok: true, answer: { outcome: "duplicate" } }, { ok: true, outcome: "duplicate" }],
    ["ignored", { ok: true, answer: { outcome: "ignored", reason: "request_closed" } }, { ok: true, outcome: "ignored", reason: "request_closed" }],
  ])("C1752: %s from the first call is returned with no fetch and one call", async (_label, result, expected) => {
    receive.mockResolvedValueOnce(result);
    expect(await run()).toEqual(expected);
    expect(fetchFiles).not.toHaveBeenCalled();
    expect(receive).toHaveBeenCalledTimes(1);
  });

  test("C1752: a refusal of the second call is returned", async () => {
    receive.mockResolvedValueOnce({ ok: true, answer: { outcome: "documents_needed", documents: URLS } });
    receive.mockResolvedValueOnce({ ok: false, code: "malformed" });
    expect(await run()).toEqual({ ok: false, code: "malformed" });
  });

  test("C1752: a second documents_needed is unavailable, never a loop", async () => {
    receive.mockResolvedValue({ ok: true, answer: { outcome: "documents_needed", documents: URLS } });
    expect(await run()).toEqual({ ok: false, code: "unavailable" });
    expect(receive).toHaveBeenCalledTimes(2);
  });
});
