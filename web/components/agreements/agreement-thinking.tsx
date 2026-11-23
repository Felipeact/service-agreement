"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { useItemWords } from "@/components/shell/item-words";
import { itemText } from "@/domain/org-settings";
import { GlowBackdrop } from "./glow-backdrop";
import { PHASE_DONE_TEXT, phaseLine, type Phase } from "./new-agreement-state";

/** The step shown once the work is done and the page is opening. */
type Step = Exclude<Phase, "idle"> | "opening";

/** How many steps stay on screen, newest first: each older one is dimmer until it fades out. */
const OPACITY = [1, 0.5, 0.26, 0.1] as const;

type Props = {
  /** What the dialog is doing now; `idle` with `leaving` is the moment the new page opens. */
  phase: Phase;
  progress: { done: number; total: number } | null;
  /** The work is finished and the browser is going to the agreement. */
  leaving: boolean;
};

/**
 * The screen over the New agreement form while it works. It sits inside the same dialog (a second modal would stack on the
 * first): a layer in the app's light colours with an animated ground and the steps as they happen ("Creating the agreement…", "Finding the equipment…
 * 2 of 5", "Building the service lines…"). The current step is bright with a pulse; finished steps turn past tense and fade out
 * as new ones arrive. Every line is a real step the dialog is on, not a script. Renders nothing while idle.
 */
export function AgreementThinking({ phase, progress, leaving }: Props) {
  const words = useItemWords();
  const reduceMotion = useReducedMotion();
  const [seen, setSeen] = useState<Step[]>([]);
  const current: Step | null = phase !== "idle" ? phase : leaving ? "opening" : null;

  // The steps seen so far, in order; cleared once the screen goes. Set while rendering, as React advises for derived state.
  if (current === null && seen.length > 0) setSeen([]);
  else if (current !== null && seen[seen.length - 1] !== current) setSeen([...seen.filter((step) => step !== current), current]);

  if (current === null) return null;

  const lineFor = (step: Step, isCurrent: boolean): string => {
    if (step === "opening") return itemText("Opening the agreement…", words);
    return isCurrent ? phaseLine(step, progress, words) : itemText(PHASE_DONE_TEXT[step], words);
  };

  const shown = seen.slice(-OPACITY.length).reverse();

  return (
    <motion.div
      data-thinking
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="absolute inset-0 z-10 flex flex-col justify-end overflow-hidden bg-ground text-ink"
    >
      <GlowBackdrop />
      <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-ground via-ground/85 to-transparent" />
      <div role="status" aria-live="polite" className="relative flex flex-col gap-3 px-6 pb-8 sm:px-8">
        <p className="text-[12px] font-semibold tracking-[0.05em] text-action uppercase">Setting up your agreement</p>
        <ul className="flex flex-col gap-2.5">
          <AnimatePresence initial={false} mode="popLayout">
            {shown.map((step, index) => (
              <motion.li
                key={step}
                layout={!reduceMotion}
                initial={reduceMotion ? false : { opacity: 0, y: 14 }}
                animate={{ opacity: OPACITY[index] ?? 0, y: 0 }}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -10, filter: "blur(4px)" }}
                transition={{ duration: reduceMotion ? 0 : 0.45, ease: "easeOut" }}
                className="flex items-center gap-3 text-[15px] font-medium"
              >
                {index === 0 ? (
                  <span aria-hidden="true" className="relative flex size-2.5 shrink-0">
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-action-glow opacity-70 motion-reduce:animate-none" />
                    <span className="relative inline-flex size-2.5 rounded-full bg-action" />
                  </span>
                ) : (
                  <span aria-hidden="true" className="flex size-2.5 shrink-0 items-center justify-center text-[11px] leading-none text-action">
                    ✓
                  </span>
                )}
                <span className="min-w-0 break-words">{lineFor(step, index === 0)}</span>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      </div>
    </motion.div>
  );
}
