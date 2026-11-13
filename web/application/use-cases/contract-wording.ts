import type { ContractWordingFailure, ContractWordingRead, ContractWordingReader, ContractWordingStore } from "@/application/ports";
import type { ContractWordingBody } from "@/domain/contract";

/** What the contract wording editor and the Templates card read: the wording and whether it is the org's own (block-editor AC 41, AC 46). */
export function makeGetContractWording(reader: ContractWordingReader) {
  return async function getContractWording(): Promise<ContractWordingRead> {
    return reader.read();
  };
}

export type SaveContractWordingResult = { ok: true; templateId: string; versionNo: number } | { ok: false; code: ContractWordingFailure };

/** Saves validated wording as the org's next contract template version, once (block-editor AC 42). */
export function makeSaveContractWording(store: ContractWordingStore) {
  return async function saveContractWording(body: ContractWordingBody): Promise<SaveContractWordingResult> {
    return store.save(body);
  };
}
