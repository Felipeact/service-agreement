import type { ReactNode } from "react";

/**
 * The options most edits never touch, folded away behind one plain label. A native disclosure: keyboard and touch work without script,
 * the summary is 44px tall below desktop, and the content stays in the page (and in a form post) while it is closed.
 */
export function MoreOptions({ children, label = "More options", open }: { children: ReactNode; label?: string; open?: boolean }) {
  return (
    <details open={open} className="group flex flex-col gap-3">
      <summary className="flex min-h-11 w-fit cursor-pointer list-none items-center gap-1.5 text-[13px] font-semibold text-action marker:hidden lg:min-h-9 [&::-webkit-details-marker]:hidden">
        <svg aria-hidden="true" viewBox="0 0 20 20" className="size-4 transition-transform duration-150 group-open:rotate-90" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M7 4l6 6-6 6" />
        </svg>
        {label}
      </summary>
      <div className="flex flex-col gap-3">{children}</div>
    </details>
  );
}
