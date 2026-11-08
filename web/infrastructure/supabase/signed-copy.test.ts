import { describe, expect, test } from "vitest";
import { stubClient, type Reply } from "./stub-client";
import { supabaseSignedCopyReader } from "./signed-copy";

const CON = "66666666-6666-4666-8666-666666666666";
const SHA = "c".repeat(64);
const fail = (code: string): Reply => ({ data: null, error: { code, message: `boom ${code}`, hint: null } });

describe("the signed copy reader", () => {
  test("C1759: it decodes PostgREST's hex form into the exact bytes and returns the stored hash", async () => {
    const { typed } = stubClient({ contract_signed_documents: { data: { content: "\\x2550444f2d0001ff", sha256: SHA }, error: null } });
    const copy = await supabaseSignedCopyReader(typed).get(CON, "signed");
    expect(Array.from(copy?.bytes ?? [])).toEqual([0x25, 0x50, 0x44, 0x4f, 0x2d, 0x00, 0x01, 0xff]);
    expect(copy?.sha256).toBe(SHA);
  });

  test("C1759: it queries the table by the document kind and the contract of the request", async () => {
    const { typed, calls } = stubClient({ contract_signed_documents: { data: { content: "\\x25", sha256: SHA }, error: null } });
    await supabaseSignedCopyReader(typed).get(CON, "audit_log");
    expect(calls).toContainEqual({ table: "contract_signed_documents", method: "eq", args: ["kind", "audit_log"] });
    expect(calls).toContainEqual({ table: "contract_signed_documents", method: "eq", args: ["contract_signature_requests.contract_id", CON] });
  });

  test("C1759: a malformed id is null without a query, and no row is null", async () => {
    const malformed = stubClient({});
    expect(await supabaseSignedCopyReader(malformed.typed).get("abc", "signed")).toBeNull();
    expect(malformed.calls).toHaveLength(0);
    expect(await supabaseSignedCopyReader(stubClient({ contract_signed_documents: { data: null, error: null } }).typed).get(CON, "signed")).toBeNull();
  });

  test("C1759: a read error is thrown, not hidden as a missing file", async () => {
    await expect(supabaseSignedCopyReader(stubClient({ contract_signed_documents: fail("XX000") }).typed).get(CON, "signed")).rejects.toThrow("XX000");
  });
});
