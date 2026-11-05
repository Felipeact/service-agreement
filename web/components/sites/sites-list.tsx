import Link from "next/link";
import type { CustomerSummary, SiteListRow } from "@/application/ports";
import { statusLabel } from "@/domain/agreement";
import { pipelineStage } from "@/domain/pipeline";
import type { SiteFilter } from "@/domain/records";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { EmptyPanel } from "@/components/ui/empty-panel";
import { Select } from "@/components/ui/select";
import { StatusPill } from "@/components/ui/status-pill";
import { TextInput } from "@/components/ui/text-input";

const COLUMNS = "md:grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)_minmax(0,1.6fr)_minmax(0,1.4fr)]";
/** Equipment types named on a row before the rest collapse into "+n more". */
const EQUIPMENT_SHOWN = 3;

const LINK = "inline-flex min-h-11 items-center text-action hover:underline lg:min-h-0";

type Props = {
  rows: SiteListRow[];
  /** Offered in the customer filter. */
  customers: CustomerSummary[];
  filter: SiteFilter;
};

/** `/sites` with the filter's text and customer kept, and `show=inactive` set or not. */
function sitesHref(filter: SiteFilter, showInactive: boolean): string {
  const params = new URLSearchParams();
  if (filter.q) params.set("q", filter.q);
  if (filter.customerId) params.set("customer", filter.customerId);
  if (showInactive) params.set("show", "inactive");
  const query = params.toString();
  return query ? `/sites?${query}` : "/sites";
}

function EquipmentCell({ row }: { row: SiteListRow }) {
  if (row.equipment.length === 0) return <span className="text-ink-2">No equipment</span>;
  const rest = row.equipment.length - EQUIPMENT_SHOWN;
  return (
    <span className="text-ink">
      {row.equipment
        .slice(0, EQUIPMENT_SHOWN)
        .map((type) => `${type.code} ×${type.count}`)
        .join(", ")}
      {rest > 0 && <span className="text-ink-2">{` +${rest} more`}</span>}
    </span>
  );
}

/** The Sites & equipment page body: header with a count, the filters, then one row per site (sites-page S1, S2). */
export function SitesListView({ rows, customers, filter }: Props) {
  const filtered = Boolean(filter.q || filter.customerId);
  const count = `${rows.length} ${rows.length === 1 ? "site" : "sites"}`;
  const showing = Boolean(filter.showInactive);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Sites & equipment" badge={rows.length > 0 ? <StatusPill tone="neutral" label={count} /> : undefined} />

      <form method="get" action="/sites" className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-end">
        <TextInput id="q" name="q" label="Search sites" defaultValue={filter.q ?? ""} placeholder="Site, address or customer" className="md:w-64" />
        <Select id="customer" name="customer" label="Customer" defaultValue={filter.customerId ?? ""} className="md:w-64">
          <option value="">All customers</option>
          {customers.map((customer) => (
            <option key={customer.id} value={customer.id}>
              {customer.name}
            </option>
          ))}
        </Select>
        {showing && <input type="hidden" name="show" value="inactive" />}
        <Button type="submit">Apply filters</Button>
        {filtered && (
          <Link href={sitesHref({}, showing)} className={`${LINK} text-[13px] font-medium`}>
            Clear filters
          </Link>
        )}
        <Link href={sitesHref(filter, !showing)} className={`${LINK} text-[13px] font-medium`}>
          {showing ? "Hide inactive" : "Show inactive"}
        </Link>
      </form>

      {rows.length === 0 ? (
        filtered ? (
          <EmptyPanel title="No sites match these filters." text="Try a different name or customer, or clear the filters." />
        ) : (
          <EmptyPanel title="No sites yet" text="Sites you add to a customer appear here.">
            <Link href="/customers" className={`${LINK} text-[13px] font-medium`}>
              Go to Customers
            </Link>
          </EmptyPanel>
        )
      ) : (
        <div className="overflow-hidden rounded-panel border border-hairline bg-surface">
          <div
            aria-hidden="true"
            className={`hidden border-b border-hairline bg-ground px-4 py-2 text-[11px] font-semibold text-ink-2 md:grid md:gap-x-3 ${COLUMNS}`}
          >
            <span>Site</span>
            <span>Customer</span>
            <span>Equipment</span>
            <span>Live agreement</span>
          </div>
          <ul className="divide-y divide-hairline">
            {rows.map((row) => (
              <li key={row.id} className={`grid grid-cols-1 gap-x-3 gap-y-1 px-4 py-3 md:items-center ${COLUMNS}`}>
                <span className="flex flex-col">
                  <span className="flex flex-wrap items-center gap-2">
                    <Link href={`/sites/${row.id}`} className={`${LINK} font-semibold`}>
                      {row.name}
                    </Link>
                    {!row.active && <StatusPill tone="neutral" label="Inactive" />}
                  </span>
                  {row.address && <span className="text-[12px] text-ink-2">{row.address}</span>}
                </span>
                <Link href={`/customers/${row.customerId}`} className={`${LINK} text-ink-2`}>
                  {row.customer}
                </Link>
                <span className="flex flex-col gap-0.5">
                  <EquipmentCell row={row} />
                  <span className="text-[12px] text-ink-2">{`${row.assetCount} ${row.assetCount === 1 ? "asset" : "assets"}`}</span>
                </span>
                {row.liveAgreement ? (
                  <span className="flex flex-wrap items-center gap-2">
                    <Link href={`/agreements/${row.liveAgreement.id}`} className={`${LINK} font-semibold`}>
                      {row.liveAgreement.number}
                    </Link>
                    {pipelineStage(row.liveAgreement.status) ? (
                      <StatusPill stage={pipelineStage(row.liveAgreement.status)!} label={statusLabel(row.liveAgreement.status)} />
                    ) : (
                      <StatusPill tone="neutral" label={statusLabel(row.liveAgreement.status)} />
                    )}
                  </span>
                ) : (
                  <span className="text-ink-2">No live agreement</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
