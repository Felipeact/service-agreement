import type { ReactNode } from "react";

type PageHeaderProps = {
  title: string;
  /** Shown beside the title, e.g. a status pill. */
  badge?: ReactNode;
  /** Filters and search. */
  controls?: ReactNode;
  /** The single primary action. */
  action?: ReactNode;
};

/** Title on the left, controls and one primary action on the right; stacks on mobile. */
export function PageHeader({ title, badge, controls, action }: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center md:gap-2.5">
      <div className="flex items-center gap-2.5 md:mr-auto">
        <h1 className="text-[22px] leading-tight font-bold">{title}</h1>
        {badge}
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
