import { describe, expect, test } from "vitest";
import type { AgreementStatus } from "../agreement";
import { CONTRACT_STATUSES, type ContractStatus } from "../contract";
import { PIPELINE_STAGES, pipelineStage, type PipelineStage } from "./index";

type Row = [AgreementStatus, ContractStatus | null, PipelineStage | null];

const CONTRACT_VALUES: Array<ContractStatus | null> = [null, ...CONTRACT_STATUSES];

const everyContract = (agreement: AgreementStatus, stage: PipelineStage | null): Row[] =>
  CONTRACT_VALUES.map((contract) => [agreement, contract, stage]);

const tables: Record<string, Row[]> = {
  C20: [...everyContract("draft", "in_progress"), ...everyContract("changes_requested", "in_progress")],
  C21: everyContract("sent", "sent"),
  C22: [
    ["accepted", null, "accepted"],
    ["accepted", "pending_signature", "accepted"],
    ["accepted", "client_signed", "accepted"],
  ],
  C23: [["accepted", "completed", "completed"]],
  C24: [...everyContract("refused", "refused"), ...everyContract("expired", "refused"), ["accepted", "declined", "refused"]],
  C25: [...everyContract("withdrawn", null), ["accepted", "voided", null]],
};

describe("pipeline stage", () => {
  test("C19: PIPELINE_STAGES is the five stage keys in board order", () => {
    expect(PIPELINE_STAGES).toEqual(["in_progress", "sent", "accepted", "completed", "refused"]);
  });

  for (const [check, rows] of Object.entries(tables)) {
    test.each(rows)(`${check}: agreement %s with contract %s is at stage %s`, (agreement, contract, stage) => {
      expect(pipelineStage(agreement, contract)).toBe(stage);
    });
  }

  test("C22: an accepted agreement with no contract argument is at stage accepted", () => {
    expect(pipelineStage("accepted")).toBe("accepted");
  });

  test("C26: the stage tables cover all 42 agreement and contract combinations once", () => {
    const keys = Object.values(tables)
      .flat()
      .map(([agreement, contract]) => `${agreement}/${contract}`);
    expect(keys).toHaveLength(42);
    expect(new Set(keys).size).toBe(42);
  });
});
