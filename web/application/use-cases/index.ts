import { applyAgreementCommand, type AgreementCommand, type AgreementStatus } from "@/domain/agreement";
import { applyContractCommand, type ContractCommand, type ContractStatus } from "@/domain/contract";
import type { TransitionErrorCode } from "@/domain/transition";
import type { AgreementRepository, CommitFailure, CommitResult, ContractRepository } from "@/application/ports";

/** A refusal is a value the caller shows; infrastructure failures are thrown (door 2). */
export type UseCaseResult<S> =
  | { ok: true; status: S; eventId: string }
  | { ok: false; error: { code: TransitionErrorCode | CommitFailure; from?: S; command: string } };

/** `revise` takes the current version from the stored agreement, so callers do not pass it. */
export type AgreementInput =
  | Exclude<AgreementCommand, { type: "revise" }>
  | { type: "revise" };

function committed<S>(result: CommitResult, status: S, from: S, command: string): UseCaseResult<S> {
  if (result.ok) return { ok: true, status, eventId: result.eventId };
  return { ok: false, error: { code: result.code, from, command } };
}

export function makeTransitionAgreement(agreements: AgreementRepository) {
  return async function transitionAgreement(input: {
    agreementId: string;
    command: AgreementInput;
  }): Promise<UseCaseResult<AgreementStatus>> {
    const { agreementId, command } = input;
    const record = await agreements.findById(agreementId);
    if (!record) return { ok: false, error: { code: "not_found", command: command.type } };

    const domainCommand: AgreementCommand =
      command.type === "revise" ? { type: "revise", versionNo: record.versionNo } : command;
    const decision = applyAgreementCommand(record.status, domainCommand);
    if (!decision.ok) return decision;

    const result = await agreements.commitTransition(agreementId, record.status, decision.event);
    return committed(result, decision.status, record.status, command.type);
  };
}

export function makeTransitionContract(contracts: ContractRepository) {
  return async function transitionContract(input: {
    contractId: string;
    command: ContractCommand;
  }): Promise<UseCaseResult<ContractStatus>> {
    const { contractId, command } = input;
    const record = await contracts.findById(contractId);
    if (!record) return { ok: false, error: { code: "not_found", command: command.type } };

    const decision = applyContractCommand(record.status, command);
    if (!decision.ok) return decision;

    const result = await contracts.commitTransition(contractId, record.status, decision.event);
    return committed(result, decision.status, record.status, command.type);
  };
}

export { makeRequestSignInLink, type SignInLinkResult } from "./sign-in";
