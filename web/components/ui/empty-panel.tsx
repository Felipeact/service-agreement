import type { ReactNode } from "react";

type EmptyPanelProps = {
  title: string;
  text?: string;
  /** A recovery action, when there is one. */
  children?: ReactNode;
};

/** The white, hairline-bordered panel every list shows when it has nothing to list. */
export function EmptyPanel({ title, text, children }: EmptyPanelProps) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-panel border border-hairline bg-surface px-4 py-12 text-center">
      <div className="flex flex-col gap-1">
        <p className="text-[14px] font-semibold">{title}</p>
        {text && <p className="text-[13px] text-ink-2">{text}</p>}
      </div>
      {children}
    </div>
  );
}
