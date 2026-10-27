"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { EXTRACT_MESSAGES, runExtraction, type ExtractState } from "./state";

type Progress = { done: number; total: number };
type ExtractControlState = ExtractState | { status: "idle" };

type PromptProps = {
  pending: boolean;
  /** Chunks done of the total, once the first answer is in. */
  progress: Progress | null;
  state: ExtractControlState;
  /** "Continue extraction" for a job that already started. */
  resume?: boolean;
  /** The extract action; absent in tests that only render markup. */
  action?: () => void;
};

/** "Extract equipment" on a read job, or "Continue extraction" on one left part way. */
export function ExtractPrompt({ pending, progress, state, resume = false, action }: PromptProps) {
  const message = state.status in EXTRACT_MESSAGES ? EXTRACT_MESSAGES[state.status as keyof typeof EXTRACT_MESSAGES] : null;
  const label = pending ? (progress ? `Extracting… ${progress.done} of ${progress.total}` : "Extracting…") : resume ? "Continue extraction" : "Extract equipment";
  return (
    <form action={action} className="flex flex-col gap-2">
      <div>
        <Button type="submit" disabled={pending}>
          {label}
        </Button>
      </div>
      {message && (
        <p role="alert" className="text-[13px] font-medium text-danger">
          {message}
        </p>
      )}
    </form>
  );
}

export function ExtractControl({ jobId, extract, resume }: { jobId: string; extract: (jobId: string) => Promise<ExtractState>; resume?: boolean }) {
  const [pending, startTransition] = useTransition();
  const [progress, setProgress] = useState<Progress | null>(null);
  const [state, setState] = useState<ExtractControlState>({ status: "idle" });

  function run() {
    startTransition(async () => {
      setProgress(null);
      setState({ status: "idle" });
      const last = await runExtraction(jobId, { extract, onProgress: (next) => startTransition(() => setProgress(next)) });
      startTransition(() => setState(last));
    });
  }

  return <ExtractPrompt pending={pending} progress={progress} state={state} resume={resume} action={run} />;
}
