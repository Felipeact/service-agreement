import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { DEFAULT_ITEM_WORDS, itemText as itemTextFor } from "@/domain/org-settings";
import { STAGES, type StageKey } from "./data";

/** The org's item word: previews speak in the default words, through the same helper the real screens use. */
export const itemText = (text: string) => itemTextFor(text, DEFAULT_ITEM_WORDS);

/** An inline link that is a 44px tap target on a phone. */
export const LINK = "inline-flex min-h-11 items-center font-semibold text-action hover:underline lg:min-h-0";

export const PANEL = "pv-panel rounded-panel border border-hairline bg-surface shadow-card";

const BTN_BASE =
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-control text-[13px] font-semibold whitespace-nowrap transition-[color,background-color,border-color,transform] duration-150 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 h-11 px-4 lg:h-[38px] [&_svg]:size-4 [&_svg]:shrink-0";
const BTN = {
  primary: "bg-action text-surface shadow-md shadow-action/20 hover:bg-action-hover",
  secondary: "border border-hairline bg-surface text-ink hover:border-line-strong hover:bg-ground",
  ghost: "text-ink-nav hover:bg-board hover:text-ink",
  danger: "border border-danger-border bg-danger-tint text-danger hover:bg-danger hover:text-surface",
} as const;
export type BtnVariant = keyof typeof BTN;
export const btn = (variant: BtnVariant = "secondary", extra = "") => `${BTN_BASE} ${BTN[variant]} ${extra}`;

export function Btn({ variant = "secondary", className = "", ...props }: ComponentProps<"button"> & { variant?: BtnVariant }) {
  return <button type="button" className={btn(variant, className)} {...props} />;
}

export function LinkBtn({ variant = "secondary", className = "", ...props }: ComponentProps<typeof Link> & { variant?: BtnVariant }) {
  return <Link className={btn(variant, className)} {...props} />;
}

/** The screen's title block: heavy, tight heading, one plain sentence under it, actions on the right. */
export function PageHead({ title, sub, badge, actions }: { title: string; sub?: ReactNode; badge?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-end md:gap-2.5">
      <div className="flex min-w-0 flex-col gap-0.5 md:mr-auto">
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-[28px] leading-9 font-extrabold tracking-[-0.02em] lg:text-[34px] lg:leading-10">{title}</h1>
          {badge}
        </div>
        {sub && <p className="max-w-2xl text-[14px] text-ink-nav">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Back({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="inline-flex min-h-11 items-center gap-1 text-[13px] font-semibold text-action hover:underline lg:min-h-8">
      <span aria-hidden="true">←</span> {children}
    </Link>
  );
}

/** A framed section with a heading row. */
export function Section({ title, sub, action, children, className = "", flush = false }: { title?: string; sub?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; flush?: boolean }) {
  return (
    <section aria-label={title} className={`${PANEL} ${className}`}>
      {(title || action) && (
        <div className="flex flex-wrap items-center gap-2 border-b border-hairline px-4 py-3 sm:px-5">
          <div className="mr-auto min-w-0">
            {title && <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>}
            {sub && <p className="text-[12px] text-ink-2">{sub}</p>}
          </div>
          {action}
        </div>
      )}
      <div className={flush ? "" : "p-4 sm:p-5"}>{children}</div>
    </section>
  );
}

export function StagePill({ stage }: { stage: StageKey }) {
  const meta = STAGES[stage];
  return (
    <span className={`inline-flex h-[22px] items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-semibold whitespace-nowrap ${meta.pill}`}>
      <span aria-hidden="true" className={`size-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  );
}

const CHIP = { neutral: "bg-board text-ink-2", attention: "bg-attention-bg text-attention-fg", good: "bg-pill-completed text-pill-completed-ink", info: "bg-action-tint text-action-press", bad: "bg-pill-refused text-pill-refused-ink" } as const;
export function Chip({ tone = "neutral", children }: { tone?: keyof typeof CHIP; children: ReactNode }) {
  return <span className={`inline-flex h-[22px] items-center rounded-full px-2.5 text-[11px] font-semibold whitespace-nowrap ${CHIP[tone]}`}>{children}</span>;
}

export function Stat({ label, value, note, tone }: { label: string; value: ReactNode; note?: ReactNode; tone?: "attention" }) {
  return (
    <div className={`${PANEL} flex flex-col gap-1 p-4`}>
      <dt className="text-[13px] font-medium text-ink-2">{label}</dt>
      <dd className={`text-[26px] leading-9 font-bold tracking-tight ${tone === "attention" ? "text-attention-fg" : ""}`}>{value}</dd>
      {note && <dd className="border-t border-hairline pt-2 text-[12px] text-ink-2">{note}</dd>}
    </div>
  );
}

export function Empty({ title, text, action }: { title: string; text: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-panel border border-dashed border-line-strong px-6 py-12 text-center">
      <p className="text-[15px] font-semibold">{title}</p>
      <p className="max-w-sm text-[13px] text-ink-2">{text}</p>
      {action}
    </div>
  );
}

export const INPUT =
  "h-11 w-full rounded-control border border-field bg-surface px-3 text-[14px] text-ink outline-none transition placeholder:text-ink-2 focus:border-action focus:ring-4 focus:ring-action/15 lg:h-10 aria-[invalid=true]:border-danger aria-[invalid=true]:focus:ring-danger/15";

export function Field({ label, hint, error, children, className = "" }: { label: string; hint?: string; error?: string; children: ReactNode; className?: string }) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      <span className="text-[13px] font-medium text-ink">{label}</span>
      {children}
      {error ? <span role="alert" className="text-[12px] font-medium text-danger">{error}</span> : hint && <span className="text-[12px] text-ink-2">{hint}</span>}
    </label>
  );
}

export const TH = "h-10 px-4 text-left text-[12px] font-semibold text-ink-2";
export const TD = "px-4 py-3 align-middle";

/** Hairline-ruled table in a framed panel; below 768px pages render a card list instead (see each screen). */
export function Table({ head, children, className = "" }: { head: ReactNode[]; children: ReactNode; className?: string }) {
  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="w-full min-w-[560px] text-left text-[14px]">
        <thead className="border-b border-hairline bg-ground/70">
          <tr>{head.map((cell, i) => <th key={i} scope="col" className={TH}>{cell}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-hairline">{children}</tbody>
      </table>
    </div>
  );
}

/** The synthetic-data label every preview screen can show. */
export function Sample() {
  return <span className="rounded-full bg-board px-2 py-0.5 text-[11px] font-semibold text-ink-2">Sample data</span>;
}
