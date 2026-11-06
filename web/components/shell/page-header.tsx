import type { ReactNode } from "react";

type PageHeaderProps = {
  title: string;
  /** Shown beside the title, e.g. a status pill. */
  badge?: ReactNode;
  /** One line under the title that says where things stand, e.g. "3 need follow-up · $59,890/yr open". */
  subtitle?: ReactNode;
  /** Filters and search. */
  controls?: ReactNode;
  /** The single primary action. */
  action?: ReactNode;
  /** A greeting-sized title, for the page a member lands on. */
  large?: boolean;
};

/** Title (and its one-line standing) on the left, controls and one primary action on the right; stacks on mobile. */
export function PageHeader({ title, badge, subtitle, controls, action, large = false }: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center md:gap-2.5">
      <div className="flex flex-col gap-0.5 md:mr-auto">
        <div className="flex items-center gap-2.5">
          <h1 className={`font-display leading-tight font-semibold tracking-tight ${large ? "text-[30px] lg:text-[34px]" : "text-[26px]"}`}>{title}</h1>
          {badge}
        </div>
        {subtitle && <p className="text-[13px] text-ink-2">{subtitle}</p>}
      </div>
      {(controls || action) && (
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
          {controls}
          {action}
        </div>
      )}
    </header>
  );
}
