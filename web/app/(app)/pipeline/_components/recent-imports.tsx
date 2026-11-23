import Link from "next/link";
import type { ImportHistoryRow } from "@/application/ports";
import { LinkButton } from "@/components/ui/link-button";
import { SectionPanel } from "@/components/ui/section-panel";
import { StatusPill } from "@/components/ui/status-pill";
import { ATTENTION, outcomeLine, REVIEWABLE, STATUS_LABELS } from "@/components/imports/job-list";
import { useItemWords } from "@/components/shell/item-words";
import { itemText } from "@/domain/org-settings";

/** How many imports the Pipeline names; the rest wait behind "All imports". */
export const RECENT_IMPORTS = 3;

/**
 * "Recent imports": the newest lists under the board, each with its file, its site and customer, how much of it was recognized
 * and its status, so a list waiting for review is seen where the estimator already is. Nothing renders until a list has been imported.
 */
export function RecentImports({ jobs }: { jobs: ImportHistoryRow[] }) {
  const words = useItemWords();
  if (jobs.length === 0) return null;
  const shown = jobs.slice(0, RECENT_IMPORTS);
  return (
    <SectionPanel id="recent-imports-title" title="Recent imports" action={<LinkButton href="/imports">All imports</LinkButton>}>
      <ul className="flex flex-col divide-y divide-hairline text-[14px]">
        {shown.map((job) => {
          const found = job.extraction?.status === "extracted" ? job.extraction : null;
          const line = found ? `${Math.max(0, found.rows - found.unmatched)} of ${found.rows} rows recognized` : outcomeLine(job);
          const shownLine = line && itemText(line, words);
          const href = REVIEWABLE.has(job.status) ? `/imports/${job.id}` : `/sites/${job.site.id}/import`;
          return (
            <li key={job.id} data-import={job.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5">
              <Link href={href} className="inline-flex min-h-11 items-center font-semibold break-all text-ink hover:text-action lg:min-h-0">
                {job.originalName}
              </Link>
              <span className="text-ink-2">{`${job.site.name} · ${job.customer.name}`}</span>
              {shownLine && <span className="ml-auto text-[12px] text-ink-2">{shownLine}</span>}
              <StatusPill tone={ATTENTION.has(job.status) ? "attention" : "neutral"} label={STATUS_LABELS[job.status]} />
            </li>
          );
        })}
      </ul>
    </SectionPanel>
  );
}
