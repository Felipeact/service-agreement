import Link from "next/link";
import type { ImportHistoryRow } from "@/application/ports";
import { Icon } from "@/components/ui/icons";
import { StatusPill } from "@/components/ui/status-pill";
import { ATTENTION, outcomeLine, REVIEWABLE, STATUS_LABELS } from "@/components/imports/job-list";

/** How many imports the Pipeline names; the rest wait behind "View all". */
export const RECENT_IMPORTS = 3;

/**
 * "Recent equipment imports": the newest equipment lists under the board, each with the file, its site and customer, how
 * much of it was recognized, and its status, so a list waiting for review is seen where the estimator already is.
 * Nothing renders until a list has been imported.
 */
export function RecentImports({ jobs }: { jobs: ImportHistoryRow[] }) {
  if (jobs.length === 0) return null;
  const shown = jobs.slice(0, RECENT_IMPORTS);
  return (
    <section aria-labelledby="recent-imports-title" className="flex flex-col gap-4 rounded-panel border border-hairline bg-surface p-5 shadow-card sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col">
          <h2 id="recent-imports-title" className="font-display text-[19px] font-semibold tracking-tight">
            Recent equipment imports
          </h2>
          <p className="text-[13px] text-ink-2">Messy files, structured into priceable assets.</p>
        </div>
        <Link href="/imports" className="inline-flex min-h-11 shrink-0 items-center text-[13px] font-medium whitespace-nowrap text-action lg:min-h-0">
          View all
        </Link>
      </div>
      <ul className="flex flex-col divide-y divide-hairline">
        {shown.map((job) => {
          const found = job.extraction?.status === "extracted" ? job.extraction : null;
          const line = found ? `${Math.max(0, found.rows - found.unmatched)} of ${found.rows} rows recognized` : outcomeLine(job);
          const href = REVIEWABLE.has(job.status) ? `/imports/${job.id}` : `/sites/${job.site.id}/import`;
          return (
            <li key={job.id} data-import={job.id}>
              <Link href={href} className="group flex flex-wrap items-center gap-x-4 gap-y-2 py-3.5 transition-colors duration-150 hover:bg-action-tint/40">
                <span className="flex min-w-[12rem] flex-1 flex-col">
                  <span className="text-[13.5px] font-semibold break-all text-ink">{job.originalName}</span>
                  <span className="text-[12px] text-ink-2">{`${job.site.name} · ${job.customer.name}`}</span>
                </span>
                {line && <span className="text-[12px] text-ink-2 sm:w-52">{line}</span>}
                <span className="flex items-center gap-2">
                  <StatusPill tone={ATTENTION.has(job.status) ? "attention" : "neutral"} label={STATUS_LABELS[job.status]} />
                  <Icon name="chevron" className="size-4 text-ink-2" />
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
