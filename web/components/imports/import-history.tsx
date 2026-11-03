import Link from "next/link";
import type { ImportHistoryRow } from "@/application/ports";
import { formatFileSize, IMPORT_STATUS_FILTERS, type ImportFilter } from "@/domain/imports";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { EmptyPanel } from "@/components/ui/empty-panel";
import { Select } from "@/components/ui/select";
import { StatusPill } from "@/components/ui/status-pill";
import { ATTENTION, date, outcomeLine, REVIEWABLE, STATUS_LABELS } from "./job-list";

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
};

/** The Imports page body: header with a count, the filters, then one row per import job (imports-page S1, S2). */
export function ImportHistoryView({ rows, sites, filter }: Props) {
  const filtered = Boolean(filter.status || filter.siteId);
  const count = `${rows.length} ${rows.length === 1 ? "import" : "imports"}`;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Imports" badge={rows.length > 0 ? <StatusPill tone="neutral" label={count} /> : undefined} />

      <form method="get" action="/imports" className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-end">
        <Select id="status" name="status" label="Status" defaultValue={filter.status ?? ""} className="md:w-52">
          <option value="">All statuses</option>
          {IMPORT_STATUS_FILTERS.map((status) => (
            <option key={status} value={status}>
              {FILTER_LABELS[status]}
            </option>
          ))}
        </Select>
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

      {rows.length === 0 ? (
        filtered ? (
          <EmptyPanel title="No imports match these filters." text="Try a different status or site, or clear the filters." />
        ) : (
          <EmptyPanel title="No imports yet" text="Equipment lists you upload to a site appear here.">
            <Link href="/sites" className={`${LINK} text-[13px] font-medium`}>
              Go to Sites &amp; equipment
            </Link>
          </EmptyPanel>
        )
      ) : (
        <ul className="flex flex-col divide-y divide-hairline rounded-panel border border-hairline bg-surface">
          {rows.map((job) => {
            const line = outcomeLine(job);
            return (
              <li key={job.id} className="flex flex-col gap-1.5 px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[14px] font-semibold break-all">{job.originalName}</p>
                  <StatusPill tone={ATTENTION.has(job.status) ? "attention" : "neutral"} label={STATUS_LABELS[job.status]} />
                </div>
                <p className="flex flex-wrap items-center gap-x-1 text-[13px] text-ink-2">
                  <Link href={`/sites/${job.site.id}`} className={LINK}>
                    {job.site.name}
                  </Link>
                  <span aria-hidden="true">·</span>
                  <Link href={`/customers/${job.customer.id}`} className={LINK}>
                    {job.customer.name}
                  </Link>
                </p>
                <p className="text-[13px] text-ink-2">
                  {formatFileSize(job.sizeBytes)} · {job.uploadedBy ?? "Former member"} · {date.format(job.createdAt)}
                </p>
                {line && <p className="text-[13px] text-ink">{line}</p>}
                {REVIEWABLE.has(job.status) ? (
                  <Link href={`/imports/${job.id}`} className={`${LINK} self-start text-[13px] font-medium`}>
                    Review rows
                  </Link>
                ) : (
                  <Link href={`/sites/${job.site.id}/import`} className={`${LINK} self-start text-[13px] font-medium`}>
                    Open on site
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
