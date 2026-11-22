import type { ReactNode } from "react";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

type EmptyPanelProps = {
  title: string;
  text?: string;
  /** A drawing above the title for a first-use or all-clear moment; leave it off for a plain "no results". */
  art?: ReactNode;
  /** A recovery action, when there is one. */
  children?: ReactNode;
};

/** The white, hairline-bordered panel every list shows when it has nothing to list: the shadcn `Empty`, in the Field Protocol card. */
export function EmptyPanel({ title, text, art, children }: EmptyPanelProps) {
  return (
    <Empty className="flex-none gap-3 rounded-panel border border-solid border-hairline bg-surface px-4 py-12 shadow-card">
      {art && <EmptyMedia className="mb-0 text-ink-2">{art}</EmptyMedia>}
      <EmptyHeader className="max-w-none gap-1">
        <EmptyTitle className="font-display text-[16px] font-semibold tracking-tight text-ink">{title}</EmptyTitle>
        {text && <EmptyDescription className="text-[13px] text-ink-2">{text}</EmptyDescription>}
      </EmptyHeader>
      {children}
    </Empty>
  );
}
