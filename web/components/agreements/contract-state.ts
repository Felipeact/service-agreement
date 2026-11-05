import type { GenerateContractFailure } from "@/application/ports";

/** What `generateContractAction` answers when it does not redirect (contract-generation AC 17). */
export type GenerateContractState = { status: "idle" | GenerateContractFailure };

/** The alert for each refusal; each says what to do next. */
export const CONTRACT_MESSAGES = {
  not_accepted: "Only an accepted agreement can become a contract.",
  auto_renewal: "This agreement was renewed automatically, so there is nothing to sign.",
  site_inactive: "This site is inactive.",
  no_term_start: "This agreement has no term start date, so it cannot become a contract.",
  no_signer: "Add an email to the site's approver or site contact, then try again.",
  forbidden: "You don't have permission to generate contracts.",
  not_found: "This agreement no longer exists.",
  unavailable: "We couldn't generate the contract. Try again.",
} as const;

/** The alert for a state, or `null` when it needs none. */
export function contractMessageFor(status: string): string | null {
  return status in CONTRACT_MESSAGES ? CONTRACT_MESSAGES[status as keyof typeof CONTRACT_MESSAGES] : null;
}
