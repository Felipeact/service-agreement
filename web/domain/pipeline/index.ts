import type { AgreementStatus } from "../agreement";
import type { ContractStatus } from "../contract";

/** The board stage a deal shows at, in board order (AD-001). */
export const PIPELINE_STAGES = ["in_progress", "sent", "accepted", "completed", "refused"] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];

/**
 * The column a deal sits in, or `null` when it is off the board. Customer-side endings show
 * under Refused; contractor-side endings (withdrawn, voided) leave the board.
 */
export function pipelineStage(agreement: AgreementStatus, contract?: ContractStatus | null): PipelineStage | null {
  switch (agreement) {
    case "draft":
    case "changes_requested":
      return "in_progress";
    case "sent":
      return "sent";
    case "refused":
    case "expired":
      return "refused";
    case "withdrawn":
      return null;
    case "accepted":
      if (contract === "completed") return "completed";
      if (contract === "declined") return "refused";
      if (contract === "voided") return null;
      return "accepted";
  }
}
