"use client";

import { CheckIcon, CopyIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/**
 * A labelled value (an address, a command) that scrolls inside its own box and has a Copy button. The button is at least 44px square
 * and says "Copied" for a moment; where the browser blocks the clipboard it says so and the text can still be selected.
 */
export function CopyField({ label, value, multiline = false }: { label: string; value: string; multiline?: boolean }) {
  const [state, setState] = useState<"idle" | "copied" | "blocked">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setState("copied");
    } catch {
      setState("blocked");
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), 2000);
  }

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="text-[13px] font-medium text-ink">{label}</span>
      <div className="flex min-w-0 items-stretch gap-2">
        <pre tabIndex={0} aria-label={label} className={`min-w-0 flex-1 overflow-x-auto rounded-card border border-hairline bg-board px-3 py-2.5 font-mono text-[13px] leading-relaxed text-ink ${multiline ? "" : "whitespace-nowrap"}`}>
          <code>{value}</code>
        </pre>
        <button
          type="button"
          onClick={handleCopy}
          aria-label={`Copy ${label}`}
          className={`inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-1.5 rounded-control border border-hairline bg-surface px-3 text-[13px] font-medium text-ink hover:bg-board ${multiline ? "self-start" : ""}`}
        >
          {state === "copied" ? <CheckIcon aria-hidden="true" className="size-4 text-action" /> : <CopyIcon aria-hidden="true" className="size-4" />}
          <span className="max-sm:sr-only">{state === "copied" ? "Copied" : state === "blocked" ? "Select and copy" : "Copy"}</span>
        </button>
      </div>
      <span role="status" className="sr-only">
        {state === "copied" ? `${label} copied` : state === "blocked" ? "Your browser blocked copying. Select the text and copy it." : ""}
      </span>
    </div>
  );
}
