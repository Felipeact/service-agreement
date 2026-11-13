import type { DraftType } from "@/domain/catalog-draft";

/** Why a draft could not be made, in the words of the use case. */
export type DraftFailure = "invalid" | "forbidden" | "not_empty" | "unreadable" | "too_large" | "unavailable";

/** What the draft form shows after an attempt; a failure keeps the trade and notes the owner typed. */
export type DraftFormState =
  | { status: "idle" }
  | { status: "drafted"; trade: string; types: DraftType[] }
  | { status: "failed"; code: DraftFailure; trade: string; notes: string };

/** What the accept form shows after an attempt; on success the page refreshes onto the new catalog. */
export type AcceptFormState = { status: "idle" } | { status: "accepted"; added: number } | { status: "failed"; code: "invalid" | "forbidden" | "not_empty" | "unavailable" };

export const DRAFT_MESSAGES: Record<DraftFailure, string> = {
  invalid: "Enter your trade in up to 60 letters, numbers and , & / ' - characters.",
  forbidden: "You don't have permission to change this.",
  not_empty: "Your catalog is no longer empty. Reload this page.",
  unreadable: "We couldn't read that file. Choose an Excel, CSV, Word or PDF file.",
  too_large: "That file is too big to draft from. Use one under 4 MB, or describe your trade instead.",
  unavailable: "We couldn't draft your catalog. Try again.",
};

export const ACCEPT_MESSAGES: Record<Extract<AcceptFormState, { status: "failed" }>["code"], string> = {
  invalid: "This draft can't be added. Check the names and months, then try again.",
  forbidden: DRAFT_MESSAGES.forbidden,
  not_empty: DRAFT_MESSAGES.not_empty,
  unavailable: "We couldn't add your catalog. Try again.",
};
