import Link from "next/link";
import type { ReactNode } from "react";
import type { ImportHistoryRow } from "@/application/ports";
import { IMPORT_STATUS_FILTERS, type ImportFilter } from "@/domain/imports";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { EmptyPanel } from "@/components/ui/empty-panel";
import { Spot } from "@/components/ui/illustrations";
import { FilterChips, type Chip } from "@/components/ui/list-panel";
import { Select } from "@/components/ui/select";
import { StatusPill } from "@/components/ui/status-pill";
import { DEFAULT_ITEM_WORDS, itemText, type ItemWords } from "@/domain/org-settings";
import { ATTENTION, date, outcomeLine, REVIEWABLE, STATUS_LABELS } from "@/components/imports/job-list";

const LINK = "inline-flex min-h-11 items-center text-action hover:underline lg:min-h-0";

const FILTER_LABELS: Record<(typeof IMPORT_STATUS_FILTERS)[number], string> = {
  attention: "Needs attention",
  uploaded: STATUS_LABELS.uploaded,
  parsed: STATUS_LABELS.parsed,
  unreadable: STATUS_LABELS.unreadable,
  extracting: STATUS_LABELS.extracting,
  extracted: STATUS_LABELS.extracted,
  committed: STATUS_LABELS.committed,
};

type Props = {
  rows: ImportHistoryRow[];
  /** Offered in the site filter, inactive sites included: their jobs stay listed. */
  sites: { id: string; name: string; customer: string }[];
  filter: ImportFilter;
  /** The drop banner for writers, above the history. */
  banner?: ReactNode;
  words?: ItemWords;
};

/** `/imports` with the site kept and the status replaced. */
function importsHref(filter: ImportFilter, status?: ImportFilter["status"]): string {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (filter.siteId) params.set("site", filter.siteId);
  const query = params.toString();
  return query ? `/imports?${query}` : "/imports";
}

/** The Imports page body: header with a count, the filters, then one row per import job (imports-page S1, S2). */
export function ImportHistoryView({ rows, sites, filter, banner, words = DEFAULT_ITEM_WORDS }: Props) {
  const filtered = Boolean(filter.status || filter.siteId);
  const chips: Chip[] = [
    { label: "All", href: importsHref(filter), active: !filter.status },
    ...IMPORT_STATUS_FILTERS.map((status): Chip => ({ label: FILTER_LABELS[status], href: importsHref(filter, status), active: filter.status === status })),
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Imports" subtitle="Every list you have brought in, and how much of it we recognized." />

      {banner}

      <div className="flex flex-col gap-3 rounded-panel border border-hairline bg-surface p-3 shadow-card">
      <FilterChips label="Filter by status" chips={chips} />

      <form method="get" action="/imports" className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-end">
        {filter.status && <input type="hidden" name="status" value={filter.status} />}
        <Select id="site" name="site" label="Site" defaultValue={filter.siteId ?? ""} className="md:w-72">
          <option value="">All sites</option>
          {sites.map((site) => (
            <option key={site.id} value={site.id}>
              {`${site.customer} · ${site.name}`}
            </option>
          ))}
        </Select>
        <Button type="submit">Apply filters</Button>
        {filtered && (
          <Link href="/imports" className={`${LINK} text-[13px] font-medium`}>
            Clear filters
          </Link>
        )}
      </form>
      </div>

      {rows.length === 0 ? (
        filtered ? (
          <EmptyPanel title="No imports match these filters." text="Try a different status or site, or clear the filters." />
        ) : (
          <EmptyPanel title="No imports yet" text={itemText("Equipment lists you upload to a site appear here.", words)} art={<Spot kind="sheet" />}>
            <Link href="/sites" className={`${LINK} text-[13px] font-medium`}>
              {`Go to Sites & ${words.plural}`}
            </Link>
          </EmptyPanel>
        )
      ) : (
        <ul className="stagger grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((job) => {
            const found0 = outcomeLine(job);
            const line = found0 && itemText(found0, words);
            const found = job.extraction?.status === "extracted" ? job.extraction : null;
            const recognized = found ? Math.max(0, found.rows - found.unmatched) : 0;
            const percent = found && found.rows > 0 ? Math.round((recognized / found.rows) * 100) : 0;
            const link = REVIEWABLE.has(job.status)
              ? { href: `/imports/${job.id}`, label: "Review rows" }
              : { href: `/sites/${job.site.id}/import`, label: "Open on site" };
            return (
              <li key={job.id} className="flex flex-col gap-3 rounded-panel border border-hairline bg-surface p-5 shadow-card">
                <div className="flex items-start gap-2">
                  <div className="mr-auto min-w-0">
                    <Link href={link.href} aria-label={`${link.label}: ${job.originalName}`} className="flex min-h-11 max-w-full items-center truncate text-[15px] font-semibold text-ink hover:text-action lg:min-h-0">
                      {job.originalName}
                    </Link>
                    <p className="flex min-w-0 items-center gap-x-1 overflow-hidden text-[12px] whitespace-nowrap text-ink-2">
                      <Link href={`/sites/${job.site.id}`} className={LINK}>
                        {job.site.name}
                      </Link>
                      <span aria-hidden="true">·</span>
                      <Link href={`/customers/${job.customer.id}`} className={LINK}>
                        {job.customer.name}
                      </Link>
                      <span aria-hidden="true">·</span>
                      <span className="truncate">{`${job.uploadedBy ?? "Former member"} · ${date.format(job.createdAt)}`}</span>
                    </p>
                  </div>
                  <StatusPill {...(ATTENTION.has(job.status) ? { tone: "attention" as const } : job.status === "committed" ? { stage: "completed" as const, filled: true } : { tone: "neutral" as const })} label={STATUS_LABELS[job.status]} />
                </div>
                {found ? (
                  <div>
                    <div className="flex justify-between text-[12px] text-ink-nav">
                      <span>Recognition</span>
                      <span className="font-semibold">{`${recognized} of ${found.rows} rows`}</span>
                    </div>
                    <span role="img" aria-label={`${percent}% of rows recognized`} className="mt-1.5 block h-2 overflow-hidden rounded-full bg-board">
                      <span className="block h-full rounded-full bg-stage-completed" style={{ width: `${percent}%` }} />
                    </span>
                    <p className="sr-only">{`${recognized} recognized · ${found.unmatched} flagged`}</p>
                  </div>
                ) : (
                  <p className="text-[13px] text-ink-2">{line ?? "Not read yet"}</p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
