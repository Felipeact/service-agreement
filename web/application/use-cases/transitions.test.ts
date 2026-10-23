import { describe, expect, test, vi } from "vitest";
import type { AgreementStatus } from "@/domain/agreement";
import type { ContractStatus } from "@/domain/contract";
import type { AgreementRepository, ContractRepository } from "@/application/ports";
import { makeTransitionAgreement, makeTransitionContract } from "./index";

function fakeAgreements(record: { status: AgreementStatus; versionNo: number } | null) {
  const repo = {
    findById: vi.fn(async () => record),
    commitTransition: vi.fn(async () => ({ ok: true as const, eventId: "evt-1" })),
  };
  return repo satisfies AgreementRepository;
}

function fakeContracts(record: { status: ContractStatus } | null) {
  const repo = {
    findById: vi.fn(async () => record),
    commitTransition: vi.fn(async () => ({ ok: true as const, eventId: "evt-2" })),
  };
  return repo satisfies ContractRepository;
}

describe("transitionAgreement", () => {
  test("C1: send on draft commits once with expected status draft and returns the event id", async () => {
    const repo = fakeAgreements({ status: "draft", versionNo: 1 });
    const result = await makeTransitionAgreement(repo)({ agreementId: "agr-1", command: { type: "send" } });

    expect(result).toEqual({ ok: true, status: "sent", eventId: "evt-1" });
    expect(repo.commitTransition).toHaveBeenCalledTimes(1);
    const [id, expected, event] = repo.commitTransition.mock.calls[0] as unknown as [string, string, { type: string }];
    expect(id).toBe("agr-1");
    expect(expected).toBe("draft");
    expect(event.type).toBe("agreement.sent");
  });

  test("C5: revise commits an event whose data.versionNo is the stored version plus one", async () => {
    const repo = fakeAgreements({ status: "changes_requested", versionNo: 2 });
    const result = await makeTransitionAgreement(repo)({ agreementId: "agr-1", command: { type: "revise" } });

    expect(result).toEqual({ ok: true, status: "draft", eventId: "evt-1" });
    const [, expected, event] = repo.commitTransition.mock.calls[0] as unknown as [
      string,
      string,
      { type: string; data: { versionNo?: number } },
    ];
    expect(expected).toBe("changes_requested");
    expect(event.type).toBe("agreement.revised");
    expect(event.data.versionNo).toBe(3);
  });

  test.each([
    ["draft", { type: "accept" }, "invalid_transition"],
    ["sent", { type: "refuse", reason: "   " }, "reason_required"],
    ["sent", { type: "refuse", reason: "x".repeat(2001) }, "reason_too_long"],
  ] as const)("C6: %s + %o returns the domain refusal %s and commits nothing", async (status, command, code) => {
    const repo = fakeAgreements({ status, versionNo: 1 });
    const result = await makeTransitionAgreement(repo)({ agreementId: "agr-1", command });

    expect(result).toEqual({ ok: false, error: { code, from: status, command: command.type } });
    expect(repo.commitTransition).toHaveBeenCalledTimes(0);
  });

  test("C18: an agreement that is not found returns not_found and commits nothing", async () => {
    const repo = fakeAgreements(null);
    const result = await makeTransitionAgreement(repo)({ agreementId: "missing", command: { type: "send" } });

    expect(result).toEqual({ ok: false, error: { code: "not_found", command: "send" } });
    expect(repo.commitTransition).toHaveBeenCalledTimes(0);
  });
});

describe("transitionContract", () => {
  test("C14: client_sign on pending_signature returns client_signed and the event id", async () => {
    const repo = fakeContracts({ status: "pending_signature" });
    const result = await makeTransitionContract(repo)({ contractId: "con-1", command: { type: "client_sign" } });

    expect(result).toEqual({ ok: true, status: "client_signed", eventId: "evt-2" });
    expect(repo.commitTransition).toHaveBeenCalledTimes(1);
    const [id, expected, event] = repo.commitTransition.mock.calls[0] as unknown as [string, string, { type: string }];
    expect(id).toBe("con-1");
    expect(expected).toBe("pending_signature");
    expect(event.type).toBe("contract.client_signed");
  });

  test("C18: a contract that is not found returns not_found and commits nothing", async () => {
    const repo = fakeContracts(null);
    const result = await makeTransitionContract(repo)({ contractId: "missing", command: { type: "client_sign" } });

    expect(result).toEqual({ ok: false, error: { code: "not_found", command: "client_sign" } });
    expect(repo.commitTransition).toHaveBeenCalledTimes(0);
  });
});
