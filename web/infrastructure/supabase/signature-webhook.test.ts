import { describe, expect, test, vi } from "vitest";
import { supabaseSignatureWebhooks } from "./signature-webhook";

function client(reply: { data: unknown; error: { code: string; message: string } | null }) {
  const rpc = vi.fn(async () => reply);
  return { rpc, typed: { rpc } as never };
}

const DELIVERY = { body: '{"event_type":"x"}', signature: `1790000000.${"a".repeat(64)}` };
const URLS = [
  { kind: "signed", url: "https://docuseal.com/file/a/d.pdf" },
  { kind: "audit_log", url: "https://docuseal.com/file/a/audit-log.pdf" },
];

describe("the signature webhook adapter", () => {
  test("C1733: it calls signature_webhook with the body, the header and null documents on a first call", async () => {
    const { rpc, typed } = client({ data: { outcome: "applied" }, error: null });
    await supabaseSignatureWebhooks(typed).receive(DELIVERY);
    expect(rpc).toHaveBeenCalledWith("signature_webhook", { p_body: DELIVERY.body, p_signature: DELIVERY.signature, p_documents: null });
  });

  test("C1733: it passes the documents of a second call as they are", async () => {
    const { rpc, typed } = client({ data: { outcome: "applied" }, error: null });
    const documents = [
      { kind: "signed" as const, content: "AQID" },
      { kind: "audit_log" as const, content: "BAUG" },
    ];
    await supabaseSignatureWebhooks(typed).receive({ ...DELIVERY, documents });
    expect(rpc).toHaveBeenCalledWith("signature_webhook", { p_body: DELIVERY.body, p_signature: DELIVERY.signature, p_documents: documents });
  });

  test("C1733: 42501 is unauthorized and 22023 is malformed", async () => {
    expect(await supabaseSignatureWebhooks(client({ data: null, error: { code: "42501", message: "bad" } }).typed).receive(DELIVERY)).toEqual({ ok: false, code: "unauthorized" });
    expect(await supabaseSignatureWebhooks(client({ data: null, error: { code: "22023", message: "bad" } }).typed).receive(DELIVERY)).toEqual({ ok: false, code: "malformed" });
  });

  test.each([
    [{ outcome: "applied" }, { outcome: "applied" }],
    [{ outcome: "duplicate" }, { outcome: "duplicate" }],
    [{ outcome: "ignored", reason: "unknown_submission" }, { outcome: "ignored", reason: "unknown_submission" }],
    [{ outcome: "documents_needed", documents: URLS }, { outcome: "documents_needed", documents: URLS }],
  ])("C1733: the answer %j is parsed", async (data, answer) => {
    expect(await supabaseSignatureWebhooks(client({ data, error: null }).typed).receive(DELIVERY)).toEqual({ ok: true, answer });
  });

  test("C1733: any other error code is thrown, with the code and not the database's message", async () => {
    const reader = supabaseSignatureWebhooks(client({ data: null, error: { code: "XX000", message: "quotes the BODY-MARKER" } }).typed);
    await expect(reader.receive(DELIVERY)).rejects.toThrow("signature_webhook failed: XX000");
    await expect(reader.receive(DELIVERY)).rejects.not.toThrow("BODY-MARKER");
  });

  test.each([
    [{ outcome: "something" }],
    [{ outcome: "ignored", reason: "other" }],
    [{ outcome: "documents_needed", documents: [URLS[0]] }],
    [null],
  ])("C1733: an answer the database does not give (%j) is thrown", async (data) => {
    await expect(supabaseSignatureWebhooks(client({ data, error: null }).typed).receive(DELIVERY)).rejects.toThrow("unknown answer");
  });
});
