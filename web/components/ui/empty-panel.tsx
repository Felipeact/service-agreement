import type { ReactNode } from "react";

type EmptyPanelProps = {
  title: string;
  text?: string;
  /** A drawing above the title for a first-use or all-clear moment; leave it off for a plain "no results". */
  art?: ReactNode;
  /** A recovery action, when there is one. */
  children?: ReactNode;
};

/** The white, hairline-bordered panel every list shows when it has nothing to list. */
export function EmptyPanel({ title, text, art, children }: EmptyPanelProps) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-panel border border-hairline bg-surface px-4 py-12 text-center shadow-card">
      {art && <div className="text-ink-2">{art}</div>}
      <div className="flex flex-col gap-1">
        <p className="font-display text-[16px] font-semibold tracking-tight">{title}</p>
        {text && <p className="text-[13px] text-ink-2">{text}</p>}
      </div>
      {children}
    </div>
  );
}
