import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, test, vi } from "vitest";
import { makeTransitionAgreement, makeTransitionContract } from "@/application/use-cases";
import type { Database } from "./database.types";
import { supabaseAgreementRepository, supabaseContractRepository } from "./index";

type RpcReply = { data: unknown; error: { code: string; message: string } | null };

/** Answers `from(...).select(...).eq(...).maybeSingle()` with `row`, and `rpc(...)` with `rpc`. */
function stubClient(row: unknown, rpc: () => Promise<RpcReply>) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    maybeSingle: vi.fn(async () => ({ data: row, error: null })),
  };
  const client = { from: vi.fn(() => query), rpc: vi.fn(rpc) };
  return { client, typed: client as unknown as SupabaseClient<Database> };
}

const failWith = (code: string) => async (): Promise<RpcReply> => ({ data: null, error: { code, message: `boom ${code}` } });

function agreementCase(rpc: () => Promise<RpcReply>) {
  const { typed } = stubClient({ status: "draft", agreement_versions: [{ version_no: 1 }] }, rpc);
  return () => makeTransitionAgreement(supabaseAgreementRepository(typed))({ agreementId: "agr-1", command: { type: "send" } });
}

function contractCase(rpc: () => Promise<RpcReply>) {
  const { typed } = stubClient({ status: "pending_signature" }, rpc);
  return () => makeTransitionContract(supabaseContractRepository(typed))({ contractId: "con-1", command: { type: "client_sign" } });
}

const cases = { agreement: agreementCase, contract: contractCase };

describe("Supabase repositories", () => {
  test("C4: a refusal is sent to apply_agreement_transition with the trimmed reason in p_payload", async () => {
    const { client, typed } = stubClient({ status: "sent", agreement_versions: [{ version_no: 1 }] }, async () => ({
      data: "evt-9",
      error: null,
    }));
    const result = await makeTransitionAgreement(supabaseAgreementRepository(typed))({
      agreementId: "agr-1",
      command: { type: "refuse", reason: "  Over budget  " },
    });

    expect(result).toEqual({ ok: true, status: "refused", eventId: "evt-9" });
    expect(client.rpc).toHaveBeenCalledWith("apply_agreement_transition", {
      p_agreement_id: "agr-1",
      p_expected_status: "sent",
      p_to_status: "refused",
      p_event_type: "agreement.refused",
      p_payload: { from: "sent", to: "refused", reason: "Over budget" },
    });
  });

  test.each([
    ["agreement", "40001", "conflict", "draft"],
    ["agreement", "P0002", "not_found", "draft"],
    ["agreement", "42501", "forbidden", "draft"],
    ["contract", "40001", "conflict", "pending_signature"],
    ["contract", "P0002", "not_found", "pending_signature"],
    ["contract", "42501", "forbidden", "pending_signature"],
  ] as const)("C16: %s rpc error %s maps to %s", async (entity, sqlstate, code, from) => {
    const result = await cases[entity](failWith(sqlstate))();
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe(code);
    expect(result.error.from).toBe(from);
  });

  test.each(["agreement", "contract"] as const)("C17: %s rejects on an unmapped code or a failed request", async (entity) => {
    await expect(cases[entity](failWith("23505"))()).rejects.toThrow(/23505/);
    await expect(
      cases[entity](async () => {
        throw new TypeError("fetch failed");
      })(),
    ).rejects.toThrow(/fetch failed/);
  });

  test("C18: findById returns null when no row is selected", async () => {
    const none = async (): Promise<RpcReply> => ({ data: null, error: null });
    expect(await supabaseAgreementRepository(stubClient(null, none).typed).findById("x")).toBeNull();
    expect(await supabaseContractRepository(stubClient(null, none).typed).findById("x")).toBeNull();
  });

  test("C19: the agreement findById returns the status and the highest version number, or 0", async () => {
    const none = async (): Promise<RpcReply> => ({ data: null, error: null });
    const withVersions = stubClient({ status: "sent", agreement_versions: [{ version_no: 1 }, { version_no: 3 }] }, none);
    expect(await supabaseAgreementRepository(withVersions.typed).findById("a")).toEqual({ status: "sent", versionNo: 3 });

    const noVersions = stubClient({ status: "draft", agreement_versions: [] }, none);
    expect(await supabaseAgreementRepository(noVersions.typed).findById("a")).toEqual({ status: "draft", versionNo: 0 });
  });
});
