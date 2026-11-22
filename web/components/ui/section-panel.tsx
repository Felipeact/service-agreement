import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type SectionPanelProps = {
  /** The heading's id, so the section can be named by it. */
  id: string;
  title: string;
  /** One quiet line under the title. */
  note?: ReactNode;
  /** A control at the right of the header: a button, a count. */
  action?: ReactNode;
  children: ReactNode;
  /** The body takes no padding of its own: a table or a list that runs edge to edge. */
  flush?: boolean;
  className?: string;
};

/**
 * A framed section: a header bar with the title (and a note under it) at the left and an action at the right, a hairline, then the
 * body. The one pattern every list, table and group of fields in the staff app sits in (docs/DESIGN.md "Components").
 */
export function SectionPanel({ id, title, note, action, children, flush = false, className }: SectionPanelProps) {
  return (
    <section aria-labelledby={id} className={cn("rounded-panel border border-hairline bg-surface shadow-card", className)}>
      <div className="flex flex-wrap items-center gap-2 border-b border-hairline px-4 py-3 sm:px-5">
        <div className="mr-auto min-w-0">
          <h2 id={id} className="text-[15px] font-semibold tracking-tight">
            {title}
          </h2>
          {note && <p className="text-[12px] text-ink-2">{note}</p>}
        </div>
        {action}
      </div>
      <div className={flush ? "" : "p-4 sm:p-5"}>{children}</div>
    </section>
  );
}
