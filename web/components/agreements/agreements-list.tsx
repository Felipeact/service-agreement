import Link from "next/link";
import type { AgreementListRow, MemberRole, SiteOption } from "@/application/ports";
import { statusLabel, STATUS_FILTER_VALUES, type AgreementFilter, type StatusFilterValue } from "@/domain/agreement";
import { pipelineStage, STAGE_LABELS } from "@/domain/pipeline";
import { canWriteRecords } from "@/components/records/state";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { EmptyPanel } from "@/components/ui/empty-panel";
import { LinkButton } from "@/components/ui/link-button";
import { Select } from "@/components/ui/select";
import { StatusPill } from "@/components/ui/status-pill";
import { formatCad } from "@/lib/money";

const COLUMNS = "md:grid-cols-[5rem_minmax(0,2fr)_minmax(0,1.5fr)_minmax(0,1.6fr)_3rem_6rem]";

const FILTER_LABELS: Record<StatusFilterValue, string> = {
  ...STAGE_LABELS,
  expired: "Expired",
  withdrawn: "Withdrawn",
};

type Props = {
  rows: AgreementListRow[];
  sites: SiteOption[];
  filter: AgreementFilter;
  /** Decides whether New agreement shows; without a role the page is read-only. */
  role?: MemberRole;
};

/** The Agreements page body: header with a count, the filters, then one row per agreement (agreements-page S1). */
export function AgreementsListView({ rows, sites, filter, role }: Props) {
  const filtered = Boolean(filter.status || filter.siteId || filter.expiring);
  const count = `${rows.length} ${rows.length === 1 ? "agreement" : "agreements"}`;
  const newAgreement = role && canWriteRecords(role) && (
    <LinkButton href="/agreements/new" variant="primary">
      New agreement
    </LinkButton>
  );

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Agreements" badge={rows.length > 0 ? <StatusPill tone="neutral" label={count} /> : undefined} action={newAgreement || undefined} />

      <form method="get" action="/agreements" className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-end">
        <Select id="status" name="status" label="Status" defaultValue={filter.status ?? ""} className="md:w-52">
          <option value="">All statuses</option>
          {STATUS_FILTER_VALUES.map((value) => (
            <option key={value} value={value}>
              {FILTER_LABELS[value]}
            </option>
          ))}
        </Select>
        <Select id="site" name="site" label="Site" defaultValue={filter.siteId ?? ""} className="md:w-64">
          <option value="">All sites</option>
          {sites.map((site) => (
            <option key={site.id} value={site.id}>
              {`${site.name} (${site.customer})`}
            </option>
          ))}
        </Select>
        <label className="flex min-h-11 items-center gap-2 text-[13px] font-medium text-ink lg:h-[34px] lg:min-h-0">
          <input type="checkbox" name="expiring" value="1" defaultChecked={filter.expiring} className="size-4" />
          Expiring soon
        </label>
        <Button type="submit">Apply filters</Button>
        {filtered && (
          <Link href="/agreements" className="inline-flex min-h-11 items-center text-[13px] font-medium text-action lg:min-h-0">
            Clear filters
          </Link>
        )}
      </form>

      {rows.length === 0 ? (
        filtered ? (
          <EmptyPanel title="No agreements match these filters." text="Try a different status or site, or clear the filters." />
        ) : (
          <EmptyPanel title="No agreements yet" text="Agreements you create appear here.">
            {newAgreement}
          </EmptyPanel>
        )
      ) : (
        <div className="overflow-hidden rounded-panel border border-hairline bg-surface">
          <div
            aria-hidden="true"
            className={`hidden border-b border-hairline bg-ground px-4 py-2 text-[11px] font-semibold text-ink-2 md:grid md:gap-x-3 ${COLUMNS}`}
          >
            <span>Number</span>
            <span>Site</span>
            <span>Customer</span>
            <span>Status</span>
            <span>Ver.</span>
            <span className="text-right">Annual</span>
          </div>
          <ul className="divide-y divide-hairline">
            {rows.map((row) => (
              <li key={row.id}>
                <Link href={`/agreements/${row.id}`} className={`grid grid-cols-2 gap-x-3 gap-y-1 px-4 py-3 hover:bg-ground md:items-center ${COLUMNS}`}>
                  <span className="font-semibold text-ink">{row.number ?? "Draft"}</span>
                  <span className="text-ink">{row.site}</span>
                  <span className="col-span-2 text-ink-2 md:col-span-1">{row.customer}</span>
                  <span className="col-span-2 md:col-span-1">
                    {pipelineStage(row.status) ? (
                      <StatusPill stage={pipelineStage(row.status)!} label={statusLabel(row.status)} />
                    ) : (
                      <StatusPill tone="neutral" label={statusLabel(row.status)} />
                    )}
                    {row.termEnd && <span className="ml-2 text-[12px] text-ink-2">{`Term ends ${row.termEnd}`}</span>}
                  </span>
                  <span className="text-ink-2">{`v${row.versionNo}`}</span>
                  <span className="text-right font-semibold text-ink">{row.annualCents === null ? "" : `${formatCad(row.annualCents)}/yr`}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
