import { afterEach, describe, expect, test, vi } from "vitest";
import { supabaseSignatureStore, supabaseSigningReader, supabaseSigningSecrets } from "./signing";
import { stubClient, type Reply } from "./stub-client";

const CON = "66666666-6666-4666-8666-666666666666";
const REQ = "77777777-7777-4777-8777-777777777777";
const HASH = "a".repeat(64);

const fail = (code: string, hint: string | null = null): Reply => ({ data: null, error: { code, message: `boom ${code}`, hint } });

afterEach(() => {
  vi.restoreAllMocks();
});

describe("signature store", () => {
  test("C1689: begin calls begin_signature_request with the contract, the name and the hash and returns the request id", async () => {
    const { client, typed } = stubClient({});
    client.rpc.mockResolvedValue({ data: REQ, error: null });
    expect(await supabaseSignatureStore(typed).begin(CON, "Dana Admin", HASH)).toEqual({ ok: true, requestId: REQ });
    expect(client.rpc).toHaveBeenCalledWith("begin_signature_request", { p_contract_id: CON, p_contractor_name: "Dana Admin", p_customer_token_hash: HASH });
  });

  test.each<[string, Reply, string]>([
    ["42501", fail("42501"), "forbidden"],
    ["P0002", fail("P0002"), "not_found"],
    ["55000 not_pending", fail("55000", "not_pending"), "not_pending"],
    ["55000 parties_missing", fail("55000", "parties_missing"), "parties_missing"],
    ["55000 already_open", fail("55000", "already_open"), "already_open"],
    ["23514 invalid_name", fail("23514", "invalid_name"), "invalid_name"],
    ["55000 with another hint", fail("55000", "other"), "unavailable"],
    ["23514 with no hint", fail("23514"), "unavailable"],
    ["any other code", fail("XX000"), "unavailable"],
  ])("C1689: begin maps %s", async (_name, reply, code) => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { client, typed } = stubClient({});
    client.rpc.mockResolvedValue(reply);
    expect(await supabaseSignatureStore(typed).begin(CON, "Dana", HASH)).toEqual({ ok: false, code });
  });

  test("C1689: begin answers unavailable for a rejected call and for no id", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const rejected = stubClient({});
    rejected.client.rpc.mockRejectedValue(new Error("network down"));
    expect(await supabaseSignatureStore(rejected.typed).begin(CON, "Dana", HASH)).toEqual({ ok: false, code: "unavailable" });
    const empty = stubClient({});
    empty.client.rpc.mockResolvedValue({ data: null, error: null });
    expect(await supabaseSignatureStore(empty.typed).begin(CON, "Dana", HASH)).toEqual({ ok: false, code: "unavailable" });
  });

  test("C1689: complete passes the request, the submission, the signers, the sealed link and the hash, and maps every error to unavailable", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const signers = [{ role: "customer" as const, submitterId: "1", embedSealed: "v1.AAAAAAAAAAAAAAAA.x" }];
    const ok = stubClient({});
    ok.client.rpc.mockResolvedValue({ data: null, error: null });
    expect(await supabaseSignatureStore(ok.typed).complete(REQ, "13226499", signers, "v1.AAAAAAAAAAAAAAAA.l", HASH)).toEqual({ ok: true });
    expect(ok.client.rpc).toHaveBeenCalledWith("complete_signature_request", {
      p_request_id: REQ,
      p_submission_id: "13226499",
      p_signers: signers,
      p_customer_link_sealed: "v1.AAAAAAAAAAAAAAAA.l",
      p_document_sha256: HASH,
    });
    for (const reply of [fail("55000", "not_creating"), fail("22023"), fail("42501"), fail("P0002")]) {
      const { client, typed } = stubClient({});
      client.rpc.mockResolvedValue(reply);
      expect(await supabaseSignatureStore(typed).complete(REQ, "1", signers, "l", HASH)).toEqual({ ok: false, code: "unavailable" });
    }
  });

  test("C1689: fail calls fail_signature_request and never throws", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const ok = stubClient({});
    ok.client.rpc.mockResolvedValue({ data: null, error: null });
    await supabaseSignatureStore(ok.typed).fail(REQ);
    expect(ok.client.rpc).toHaveBeenCalledWith("fail_signature_request", { p_request_id: REQ });
    const rejected = stubClient({});
    rejected.client.rpc.mockRejectedValue(new Error("down"));
    await expect(supabaseSignatureStore(rejected.typed).fail(REQ)).resolves.toBeUndefined();
    const refused = stubClient({});
    refused.client.rpc.mockResolvedValue(fail("42501"));
    await expect(supabaseSignatureStore(refused.typed).fail(REQ)).resolves.toBeUndefined();
  });
});

describe("signing secrets", () => {
  test.each<["customerLink" | "contractorSource", string]>([
    ["customerLink", "customer_signing_link"],
    ["contractorSource", "contractor_signing_source"],
  ])("C1712: %s calls %s with the contract and returns the sealed value", async (method, fn) => {
    const { client, typed } = stubClient({});
    client.rpc.mockResolvedValue({ data: "v1.AAAAAAAAAAAAAAAA.x", error: null });
    expect(await supabaseSigningSecrets(typed)[method](CON)).toEqual({ ok: true, sealed: "v1.AAAAAAAAAAAAAAAA.x" });
    expect(client.rpc).toHaveBeenCalledWith(fn, { p_contract_id: CON });
  });

  test.each<[string, Reply, string]>([
    ["42501", fail("42501"), "forbidden"],
    ["P0002", fail("P0002"), "not_found"],
    ["55000 not_client_signed", fail("55000", "not_client_signed"), "not_client_signed"],
    ["55000 no_request", fail("55000", "no_request"), "no_request"],
    ["55000 with another hint", fail("55000", "other"), "unavailable"],
    ["any other code", fail("XX000"), "unavailable"],
  ])("C1712: %s is %s", async (_name, reply, code) => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    for (const method of ["customerLink", "contractorSource"] as const) {
      const { client, typed } = stubClient({});
      client.rpc.mockResolvedValue(reply);
      expect(await supabaseSigningSecrets(typed)[method](CON)).toEqual({ ok: false, code });
    }
  });

  test("C1712: a rejected call and an empty answer are unavailable", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const rejected = stubClient({});
    rejected.client.rpc.mockRejectedValue(new Error("down"));
    expect(await supabaseSigningSecrets(rejected.typed).customerLink(CON)).toEqual({ ok: false, code: "unavailable" });
    const empty = stubClient({});
    empty.client.rpc.mockResolvedValue({ data: null, error: null });
    expect(await supabaseSigningSecrets(empty.typed).contractorSource(CON)).toEqual({ ok: false, code: "unavailable" });
  });
});

const VIEW = {
  tenant: { name: "Kettle Ridge Mechanical Ltd.", address: "100 Sample Street", phone: "604-555-0100", accent: "#1f6f8b" },
  agreement: { number: "AG-1052" },
  signer: { name: "Pat Lee" },
  contractStatus: "pending_signature",
  requestStatus: "open",
  embedSealed: "v1.AAAAAAAAAAAAAAAA.x",
};

describe("signing reader", () => {
  test("C1702: an object becomes the typed view, and the call carries the hash", async () => {
    const { client, typed } = stubClient({});
    client.rpc.mockResolvedValue({ data: VIEW, error: null });
    expect(await supabaseSigningReader(typed).view(HASH)).toEqual({
      tenant: { name: "Kettle Ridge Mechanical Ltd.", address: "100 Sample Street", phone: "604-555-0100", accent: "#1f6f8b", logoPath: null },
      agreementNumber: "AG-1052",
      signerName: "Pat Lee",
      contractStatus: "pending_signature",
      requestStatus: "open",
      embedSealed: "v1.AAAAAAAAAAAAAAAA.x",
    });
    expect(client.rpc).toHaveBeenCalledWith("signature_view", { p_token_hash: HASH });
  });

  test("C1702: null is null, and an object missing the embed, the contract status or the request status is read as follows", async () => {
    const nothing = stubClient({});
    nothing.client.rpc.mockResolvedValue({ data: null, error: null });
    expect(await supabaseSigningReader(nothing.typed).view(HASH)).toBeNull();

    const closed = stubClient({});
    closed.client.rpc.mockResolvedValue({ data: { ...VIEW, embedSealed: null, requestStatus: "failed" }, error: null });
    expect((await supabaseSigningReader(closed.typed).view(HASH))?.embedSealed).toBeNull();

    for (const missing of ["contractStatus", "requestStatus", "embedSealed"] as const) {
      // `undefined` drops the key from the JSON the database would send.
      const { client, typed } = stubClient({});
      client.rpc.mockResolvedValue({ data: JSON.parse(JSON.stringify({ ...VIEW, [missing]: undefined })), error: null });
      expect(await supabaseSigningReader(typed).view(HASH), missing).toBeNull();
    }
    const unknownStatus = stubClient({});
    unknownStatus.client.rpc.mockResolvedValue({ data: { ...VIEW, contractStatus: "mystery" }, error: null });
    expect(await supabaseSigningReader(unknownStatus.typed).view(HASH)).toBeNull();
  });

  test("C1702: an error is thrown, not hidden as an unknown link", async () => {
    const { client, typed } = stubClient({});
    client.rpc.mockResolvedValue(fail("XX000"));
    await expect(supabaseSigningReader(typed).view(HASH)).rejects.toThrow("XX000");
  });
});

describe("signing reader, logo", () => {
  test("C3336: tenant.logoPath becomes the view's tenant.logoPath, and a reply with no logoPath key gives null", async () => {
    const { client, typed } = stubClient({});
    const path = "11111111-1111-4111-8111-111111111111/33333333-3333-4333-8333-333333333333.png";
    client.rpc.mockResolvedValue({ data: { ...VIEW, tenant: { ...VIEW.tenant, logoPath: path } }, error: null });
    expect((await supabaseSigningReader(typed).view(HASH))?.tenant?.logoPath).toBe(path);
    client.rpc.mockResolvedValue({ data: VIEW, error: null });
    expect((await supabaseSigningReader(typed).view(HASH))?.tenant?.logoPath).toBeNull();
  });
});

