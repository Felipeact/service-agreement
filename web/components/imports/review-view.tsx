import Link from "next/link";
import type { AssetTypeOption, ImportReview, ImportRowView } from "@/application/ports";
import { PageHeader } from "@/components/shell/page-header";
import { StatusPill } from "@/components/ui/status-pill";
import { addLabel, committedSummary, fixLine, flagRows, isBlocking, pageOf, REVIEW_PAGE_ROWS, unmatchedSpellings, type ReviewFlag } from "@/domain/imports";
import { CommitControl, MappingSection, RowControls } from "./review-controls";
import type { CommitState, MapState, RowState } from "./state";

export type ReviewActions = {
  update: (rowId: string) => (formData: FormData) => Promise<RowState>;
  /** Sets the row's `skipped` to the value given. */
  skip: (rowId: string, skipped: boolean) => () => Promise<RowState>;
  map: (formData: FormData) => Promise<MapState>;
  commit: () => Promise<CommitState>;
};

type ReviewViewProps = {
  review: ImportReview;
  /** The org's asset types, ordered by name. */
  types: AssetTypeOption[];
  /** The site's current assets, for "Already on this site". */
  siteAssets: { assetTypeId: string; unitNo: string | null }[];
  show: "all" | "attention";
  /** The raw `?page` value. */
  page?: string;
  /** The writer's actions; absent for a viewer, who sees the rows and flags only. */
  actions?: ReviewActions;
};

const CONFIDENCE = { low: "Low", medium: "Medium", high: "High" } as const;

const plural = (n: number, word: string) => `${n.toLocaleString("en-CA")} ${word}${n === 1 ? "" : "s"}`;

function flagLabel(flag: ReviewFlag): string {
  switch (flag.kind) {
    case "needs_type":
      return "Needs a type";
    case "too_long":
      return `Too long: ${flag.field}`;
    case "check":
      return "Check this row";
    case "same_as":
      return `Same as row ${flag.position}`;
    case "on_site":
      return "Already on this site";
  }
}

const COLUMNS = ["#", "Equipment type", "In file", "Unit #", "Type/model", "Location/access", "Confidence", "Source"];

/** One cell: its column name above the value below 768px, a table cell from 768px. */
function Cell({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`min-w-0 break-words ${className}`}>
      <span className="block text-[11px] font-medium text-ink-2 md:sr-only">{label}</span>
      {children}
    </div>
  );
}

function hrefFor(jobId: string, show: "all" | "attention", page?: number) {
  const params = new URLSearchParams();
  if (show === "attention") params.set("show", "attention");
  if (page && page > 1) params.set("page", String(page));
  const query = params.toString();
  return `/imports/${jobId}${query ? `?${query}` : ""}`;
}

/** The review grid of an extracted job, or the read-only record of a committed one. */
export function ReviewView({ review, types, siteAssets, show, page, actions }: ReviewViewProps) {
  const { job, rows } = review;
  const open = job.status === "extracted";
  const writer = open ? actions : undefined;
  const typeLabel = new Map(types.map((type) => [type.id, `${type.name} (${type.code})`]));
  // Once committed, the site holds the rows' own assets, so comparing against it would flag every added row.
  const flags = flagRows(rows, open ? siteAssets : []);
  const flagsOf = (row: ImportRowView) => flags.get(row.id) ?? [];
  const included = rows.filter((row) => !row.skipped);
  const attention = included.filter((row) => flagsOf(row).length > 0);
  const blocking = included.filter((row) => flagsOf(row).some(isBlocking)).length;
  const shown = show === "attention" ? attention : rows;
  const pager = pageOf(shown.length, page);
  const pageRows = [...shown].sort((a, b) => a.position - b.position).slice((pager.page - 1) * REVIEW_PAGE_ROWS, pager.page * REVIEW_PAGE_ROWS);
  const spellings = writer ? unmatchedSpellings(rows) : [];
  const filter = (active: boolean) => `inline-flex min-h-11 items-center text-[13px] font-medium lg:min-h-0 ${active ? "text-ink" : "text-action"}`;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Link href={`/sites/${job.siteId}/import`} className="inline-flex min-h-11 items-center text-[13px] font-medium text-action lg:min-h-0">
          Back to imports
        </Link>
        <PageHeader title={job.originalName} badge={<StatusPill tone="neutral" label={open ? "Extracted" : "Added to site"} />} />
        <p className="text-[13px] text-ink-2">{job.siteName}</p>
      </div>

      {job.committed && (
        <section className="flex flex-col gap-2 rounded-panel border border-hairline bg-surface px-4 py-3">
          <p className="text-[14px] font-semibold">{committedSummary(job.committed.added, job.committed.skipped)}</p>
          <Link href={`/sites/${job.siteId}`} className="inline-flex min-h-11 items-center self-start text-[13px] font-medium text-action lg:min-h-0">
            {`View ${job.siteName}`}
          </Link>
        </section>
      )}

      {rows.length === 0 ? (
        <p className="rounded-panel border border-hairline bg-surface px-4 py-8 text-center text-[13px] text-ink-2">No equipment was found in this file.</p>
      ) : (
        <>
          {writer && (
            <section className="flex flex-col gap-3 rounded-panel border border-hairline bg-surface px-4 py-3">
              <CommitControl
                commit={writer.commit}
                label={addLabel(included.length, job.siteName)}
                siteName={job.siteName}
                added={included.length}
                blocked={included.length === 0 ? "Include at least one row to add." : blocking > 0 ? fixLine(blocking) : null}
              />
            </section>
          )}

          {writer && <MappingSection spellings={spellings} types={types} map={writer.map} />}

          <section className="flex flex-col gap-3">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[13px] text-ink">{`${plural(rows.length, "row")} · ${included.length.toLocaleString("en-CA")} included · ${attention.length.toLocaleString("en-CA")} need attention`}</p>
              <nav aria-label="Filter rows" className="flex gap-4">
                <Link href={hrefFor(job.id, "all")} aria-current={show === "all" ? "page" : undefined} className={filter(show === "all")}>
                  All rows
                </Link>
                <Link href={hrefFor(job.id, "attention")} aria-current={show === "attention" ? "page" : undefined} className={filter(show === "attention")}>
                  Needs attention
                </Link>
              </nav>
            </div>

            {pageRows.length === 0 ? (
              <p className="rounded-panel border border-hairline bg-surface px-4 py-8 text-center text-[13px] text-ink-2">Every row is ready to add.</p>
            ) : (
              <div className="relative rounded-panel border border-hairline bg-surface md:overflow-x-auto">
                {/* `relative` keeps the `md:sr-only` column labels (absolutely positioned) inside the scroll area. */}
                <div className="md:min-w-[960px]">
                  <div aria-hidden="true" className="hidden grid-cols-[40px_1.3fr_1fr_0.8fr_1fr_1.2fr_0.7fr_0.8fr] gap-3 border-b border-hairline px-4 py-2 text-[11px] font-semibold text-ink-2 md:grid">
                    {COLUMNS.map((column) => (
                      <span key={column}>{column}</span>
                    ))}
                  </div>
                  <ul className="flex flex-col divide-y divide-hairline">
                    {pageRows.map((row) => {
                      const rowFlags = flagsOf(row);
                      const ink = row.skipped ? "text-ink-2" : "text-ink";
                      return (
                        <li key={row.id} data-row={row.position} className="flex flex-col gap-2 px-4 py-3">
                          <div className={`grid grid-cols-2 gap-x-3 gap-y-2 text-[13px] md:grid-cols-[40px_1.3fr_1fr_0.8fr_1fr_1.2fr_0.7fr_0.8fr] ${ink}`}>
                            <Cell label="#">{row.position}</Cell>
                            <Cell label="Equipment type" className="font-medium">
                              {row.assetTypeId ? (typeLabel.get(row.assetTypeId) ?? "Unknown type") : "Needs a type"}
                            </Cell>
                            <Cell label="In file">{row.assetTypeRaw ?? "-"}</Cell>
                            <Cell label="Unit #">{row.unitNo ?? "-"}</Cell>
                            <Cell label="Type/model">{row.typeModel ?? "-"}</Cell>
                            <Cell label="Location/access">{row.location ?? "-"}</Cell>
                            <Cell label="Confidence">{CONFIDENCE[row.confidence]}</Cell>
                            <Cell label="Source">{row.sourceRef ?? "-"}</Cell>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            {!open && <StatusPill tone="neutral" label={row.skipped ? "Skipped" : "Added"} />}
                            {open && row.skipped && <StatusPill tone="neutral" label="Skipped" />}
                            {rowFlags.map((flag) => (
                              <StatusPill key={flagLabel(flag)} tone="attention" label={flagLabel(flag)} />
                            ))}
                          </div>
                          {writer && (
                            <RowControls row={row} types={types} update={writer.update(row.id)} toggleSkip={writer.skip(row.id, !row.skipped)} />
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            )}

            {pager.pages > 1 && (
              <nav aria-label="Pages" className="flex flex-wrap items-center gap-4 text-[13px]">
                {pager.page > 1 && (
                  <Link href={hrefFor(job.id, show, pager.page - 1)} className="inline-flex min-h-11 items-center font-medium text-action lg:min-h-0">
                    Previous
                  </Link>
                )}
                <span className="text-ink-2">{`Rows ${pager.from}-${pager.to} of ${shown.length.toLocaleString("en-CA")}`}</span>
                {pager.page < pager.pages && (
                  <Link href={hrefFor(job.id, show, pager.page + 1)} className="inline-flex min-h-11 items-center font-medium text-action lg:min-h-0">
                    Next
                  </Link>
                )}
              </nav>
            )}
          </section>
        </>
      )}
    </div>
  );
}
