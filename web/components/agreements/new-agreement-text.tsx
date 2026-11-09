"use client";

import { useItemWords } from "@/components/shell/item-words";
import { itemText } from "@/domain/org-settings";
import { phaseLine, type Phase } from "./new-agreement-state";

/** The progress line under the New agreement form, in the org's words. */
export function ProgressLine({ phase, progress }: { phase: Phase; progress: { done: number; total: number } | null }) {
  return <>{phaseLine(phase, progress, useItemWords())}</>;
}

/** A notice's text spoken in the org's words (the list-failed message names the item). */
export function NoticeText({ text }: { text: string }) {
  return <>{itemText(text, useItemWords())}</>;
}
