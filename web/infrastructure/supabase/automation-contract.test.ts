import { describe, expect, test } from "vitest";
import { supabaseAutomationCallbacks } from "./automation";
import { stubClient } from "./stub-client";

const CALLBACK = { body: '{"kind":"contract_ready"}', timestamp: "1700000000", signature: `sha256=${"a".repeat(64)}` };
const tenant = { legalName: "Northwind Mechanical Ltd.", phone: "604-555-0100", accent: "#0f766e" };

const ready = (over: Record<string, unknown> = {}) => ({
  notificationId: "n1",
  kind: "staff_contract_ready",
  to: ["owner@northwind.ca"],
  tenant,
  agreement: { id: "a1", number: "AG-1052" },
  site: { name: "Harbourview Towers" },
  contract: { id: "con-1" },
  refusal: null,
  ...over,
});

async function claimOf(message: Record<string, unknown>) {
  const { client, typed } = stubClient({});
  client.rpc.mockResolvedValue({ data: { decision: "send", messages: [message] }, error: null });
  return supabaseAutomationCallbacks(typed).claim(CALLBACK);
}

describe("the automation callbacks adapter, contract messages", () => {
  test("C1789: a staff_contract_ready message with a contract becomes the app's type", async () => {
    expect(await claimOf(ready())).toEqual({
      ok: true,
      decision: "send",
      messages: [
        {
          notificationId: "n1",
          kind: "staff_contract_ready",
          to: ["owner@northwind.ca"],
          tenant,
          agreement: { id: "a1", number: "AG-1052" },
          site: { name: "Harbourview Towers" },
          contract: { id: "con-1" },
          refusal: null,
        },
      ],
    });
  });

  test("C1789: a refusal with no contract becomes the app's type with that refusal", async () => {
    const result = await claimOf(ready({ contract: null, refusal: "no_signer" }));
    expect(result).toMatchObject({ ok: true, messages: [{ contract: null, refusal: "no_signer" }] });
  });

  test.each([
    ["no contract and no refusal", ready({ contract: null })],
    ["an unknown refusal and no contract", ready({ contract: null, refusal: "made_up" })],
    ["no agreement", ready({ agreement: undefined })],
  ])("C1789: %s throws 'automation_claim returned a malformed staff_contract_ready message'", async (_label, message) => {
    await expect(claimOf(message)).rejects.toThrow("automation_claim returned a malformed staff_contract_ready message");
  });

  test("C1789: a customer_signing_link without its sealed link throws, with it the message is read", async () => {
    const base = { notificationId: "n2", kind: "customer_signing_link", to: ["pat@customer.ca"], tenant, agreement: { id: "a1", number: "AG-1052" }, site: { name: "S" }, signerName: "Pat Lee" };
    await expect(claimOf(base)).rejects.toThrow("malformed customer_signing_link message");
    expect(await claimOf({ ...base, linkSealed: "v1.abc" })).toMatchObject({ ok: true, messages: [{ kind: "customer_signing_link", linkSealed: "v1.abc", signerName: "Pat Lee" }] });
  });

  test("C1789: a contract_signed_copy needs its key and exactly two valid documents; a staff_contract_signed needs its contract and key", async () => {
    const copy = {
      notificationId: "n3",
      kind: "contract_signed_copy",
      idempotencyKey: "w4:e:copy:customer",
      to: ["pat@customer.ca"],
      tenant,
      agreement: { id: "a1", number: "AG-1052" },
      site: { name: "S" },
      signerName: "Pat Lee",
      documents: [
        { kind: "signed", contentBase64: "AAAA" },
        { kind: "audit_log", contentBase64: "BBBB" },
      ],
    };
    expect(await claimOf(copy)).toMatchObject({ ok: true, messages: [{ kind: "contract_signed_copy", idempotencyKey: "w4:e:copy:customer", documents: copy.documents }] });
    await expect(claimOf({ ...copy, documents: [copy.documents[0]] })).rejects.toThrow("malformed contract_signed_copy message");
    await expect(claimOf({ ...copy, documents: [copy.documents[0], { kind: "other", contentBase64: "CC" }] })).rejects.toThrow("malformed contract_signed_copy message");
    await expect(claimOf({ ...copy, idempotencyKey: undefined })).rejects.toThrow("malformed contract_signed_copy message");

    const staff = { notificationId: "n4", kind: "staff_contract_signed", idempotencyKey: "w4:e:staff", to: ["o@n.ca"], tenant, agreement: { id: "a1", number: "AG-1052" }, contract: { id: "con-1" }, site: { name: "S" }, customer: { name: "Fernwood" } };
    expect(await claimOf(staff)).toMatchObject({ ok: true, messages: [{ kind: "staff_contract_signed", contract: { id: "con-1" }, customer: { name: "Fernwood" } }] });
    await expect(claimOf({ ...staff, contract: undefined })).rejects.toThrow("malformed staff_contract_signed message");
    await expect(claimOf({ ...staff, idempotencyKey: undefined })).rejects.toThrow("malformed staff_contract_signed message");
  });
});
