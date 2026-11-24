import type { ReactNode } from "react";
import { CheckIcon, CircleIcon } from "lucide-react";

const panel = "rounded-panel border border-hairline bg-surface shadow-card";

/**
 * A section of the agreement page. On a draft it carries the tick its item has in "Before you send" (`isDone`), and an open
 * one is ringed amber; on a version that cannot change, `isDone` is left out and the section is plain.
 */
export function GuidedSection({
  id,
  label,
  title,
  state,
  isDone,
  action,
  children,
}: {
  id: string;
  /** The section's accessible name; defaults to the title. */
  label?: string;
  title: string;
  /** A short line beside the title: what the section holds, or what is missing. */
  state?: string;
  isDone?: boolean;
  /** A control on the right of the header, such as "Add a line". */
  action?: ReactNode;
  children: ReactNode;
}) {
  const isOpen = isDone === false;
  return (
    <section id={id} aria-label={label ?? title} className={`scroll-mt-20 overflow-hidden ${panel} ${isOpen ? "border-amber-300 ring-2 ring-amber-100" : ""}`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-hairline px-5 py-3">
        {isDone !== undefined && (
          <span className={`flex size-6 shrink-0 items-center justify-center rounded-full ${isDone ? "bg-emerald-50" : "bg-amber-50"}`}>
            {isDone ? <CheckIcon className="size-4 text-emerald-600" aria-label="Done" /> : <CircleIcon className="size-4 text-amber-500" aria-label="To do" />}
          </span>
        )}
        <h2 className="text-[16px] font-bold tracking-tight">{title}</h2>
        {state && <p className={`text-[13px] ${isOpen ? "font-semibold text-amber-700" : "text-ink-2"}`}>{state}</p>}
        {action && <div className="ml-auto">{action}</div>}
      </div>
      {children}
    </section>
  );
}

export type Fact = { label: string; value: string; note: string; isOpen?: boolean };

/** The strip under the header: what the agreement is worth, how often, what it covers, and the term. */
export function FactsStrip({ facts }: { facts: Fact[] }) {
  return (
    <dl aria-label="At a glance" className={`grid grid-cols-2 overflow-hidden lg:grid-cols-4 lg:divide-x lg:divide-hairline ${panel}`}>
      {facts.map((fact) => (
        <div key={fact.label} className="flex flex-col gap-0.5 px-5 py-4">
          <dt className="text-[13px] text-ink-2">{fact.label}</dt>
          <dd className={`text-[22px] leading-tight font-extrabold tabular-nums tracking-tight ${fact.isOpen ? "text-amber-700" : ""}`}>{fact.value}</dd>
          <dd className={`text-[12px] ${fact.isOpen ? "font-medium text-amber-700" : "text-ink-2"}`}>{fact.note}</dd>
        </div>
      ))}
    </dl>
  );
}
