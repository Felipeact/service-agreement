"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { CustomerSummary, SiteListRow } from "@/application/ports";
import { statusLabel } from "@/domain/agreement";
import { pipelineStage } from "@/domain/pipeline";
import type { SiteFilter } from "@/domain/records";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { EmptyPanel } from "@/components/ui/empty-panel";
import { Spot } from "@/components/ui/illustrations";
import { ListPanel, ROW_CLASSES } from "@/components/ui/list-panel";
import { SearchInput } from "@/components/ui/search-input";
import { StatCard } from "@/components/ui/stat-card";
import { BellIcon, FileTextIcon, LayersIcon, MapPinIcon } from "lucide-react";
import { Select } from "@/components/ui/select";
import { useItemWords } from "@/components/shell/item-words";
import { StatusPill } from "@/components/ui/status-pill";

const COLUMNS = "md:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)_minmax(0,1.8fr)_minmax(0,1.4fr)]";
/** Equipment types named on a row before the rest collapse into "+n more". */
const EQUIPMENT_SHOWN = 3;

const LINK = "inline-flex min-h-11 items-center text-action hover:underline lg:min-h-0";

type Segment = "all" | "live" | "none";

const SEGMENTS: { value: Segment; label: string }[] = [
  { value: "all", label: "All" },
  { value: "live", label: "With a live agreement" },
  { value: "none", label: "No live agreement" },
];

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

/** The equipment types on a site as small tiles ("RTU ×4"), the first few and then "+n more". */
function EquipmentCell({ row }: { row: SiteListRow }) {
  const words = useItemWords();
  if (row.equipment.length === 0) return <span className="text-ink-2">{`No ${words.plural}`}</span>;
  const rest = row.equipment.length - EQUIPMENT_SHOWN;
  return (
    <span className="flex flex-wrap items-center gap-1">
      {row.equipment.slice(0, EQUIPMENT_SHOWN).map((type) => (
        <span key={type.code} className="inline-flex items-center gap-1 rounded-control bg-board px-1.5 py-0.5 text-[12px] font-medium text-ink">
          {`${type.code} ×${type.count}`}
        </span>
      ))}
      {rest > 0 && <span className="text-[12px] text-ink-2">{`+${rest} more`}</span>}
    </span>
  );
}

/**
 * The Sites & equipment page body, laid out like Agreements: a header, four summary cards, a segmented control beside the
 * customer picker and a search, then one row per site (sites-page S1, S2). The customer and inactive filters live in the
 * URL (the picker navigates on change); the segment and the search narrow the rows on the page.
 */
export function SitesListView({ rows, customers, filter }: Props) {
  const words = useItemWords();
  const router = useRouter();
  const [query, setQuery] = useState(filter.q ?? "");
  const [segment, setSegment] = useState<Segment>("all");
  const showing = Boolean(filter.showInactive);
  const filtered = Boolean(filter.q || filter.customerId);

  const needle = query.trim().toLowerCase();
  const shown = rows
    .filter((row) => (segment === "live" ? Boolean(row.liveAgreement) : segment === "none" ? !row.liveAgreement : true))
    .filter((row) => !needle || [row.name, row.address ?? "", row.customer].some((text) => text.toLowerCase().includes(needle)));

  const assets = rows.reduce((sum, row) => sum + row.assetCount, 0);
  const live = rows.filter((row) => row.liveAgreement).length;
  // A site with equipment and no live agreement is ready for one: the next thing to quote.
  const ready = rows.filter((row) => !row.liveAgreement && row.assetCount > 0).length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={`Sites & ${words.plural}`} subtitle={`Every site you maintain, the ${words.plural} on it, and the agreement that covers it.`} />

      <div className="stagger grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:gap-4">
        <StatCard label="Sites" icon={<MapPinIcon />} value={String(rows.length)} note={filtered ? "Matching this view" : showing ? "Including inactive" : "Active in your workspace"} />
        <StatCard label="Assets" icon={<LayersIcon />} value={assets.toLocaleString("en-CA")} note="Across these sites" />
        <StatCard label="Live agreements" icon={<FileTextIcon />} value={String(live)} note="Sites under agreement" />
        <StatCard label="Ready to quote" icon={<BellIcon />} value={String(ready)} note={`${words.Plural}, no agreement yet`} />
      </div>

      <div className="flex flex-col gap-3 rounded-panel border border-hairline bg-surface p-3 shadow-card lg:flex-row lg:items-center lg:justify-between">
        <nav aria-label="Filter by agreement" className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] lg:mx-0 lg:px-0">
          <div className="inline-flex gap-1">
            {SEGMENTS.map((item) => (
              <button
                key={item.value}
                type="button"
                aria-pressed={segment === item.value}
                onClick={() => setSegment(item.value)}
                className={`inline-flex h-11 shrink-0 items-center rounded-[6px] px-3.5 text-[13px] font-medium whitespace-nowrap transition-colors duration-150 lg:h-8 ${
                  segment === item.value ? "bg-action-tint font-semibold text-action-press" : "text-ink-nav hover:bg-board hover:text-ink"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </nav>
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
          <Select
            id="customer"
            label="Customer"
            value={filter.customerId ?? ""}
            onChange={(event) => router.push(sitesHref({ ...filter, q: query.trim() || undefined, customerId: event.target.value || undefined }, showing))}
            className="sm:w-56 [&>label]:sr-only"
          >
            <option value="">All customers</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name}
              </option>
            ))}
          </Select>
          <Link
            href={sitesHref(filter, !showing)}
            aria-current={showing ? "true" : undefined}
            className={`inline-flex h-11 shrink-0 items-center justify-center rounded-control border px-3.5 text-[13px] font-medium whitespace-nowrap transition-colors duration-150 lg:h-[34px] ${
              showing ? "border-action bg-action-tint text-action" : "border-hairline bg-surface text-ink hover:bg-ground"
            }`}
          >
            {showing ? "Hide inactive" : "Show inactive"}
          </Link>
          <SearchInput label="Search sites" placeholder="Search this list…" value={query} onChange={(event) => setQuery(event.target.value)} className="min-w-0 sm:w-56" />
        </div>
      </div>

      {rows.length === 0 ? (
        filtered ? (
          <EmptyPanel title="No sites match these filters." text="Try a different customer, or clear the filters.">
            <Link href={sitesHref({}, showing)} className={`${LINK} text-[13px] font-medium`}>
              Clear filters
            </Link>
          </EmptyPanel>
        ) : (
          <EmptyPanel title="No sites yet" text="Sites you add to a customer appear here." art={<Spot kind="pin" />}>
            <Link href="/customers" className={`${LINK} text-[13px] font-medium`}>
              Go to Customers
            </Link>
          </EmptyPanel>
        )
      ) : shown.length === 0 ? (
        <EmptyPanel title={needle ? `No sites match "${query}"` : "No sites in this view"}>
          <Button
            onClick={() => {
              setQuery("");
              setSegment("all");
            }}
          >
            Show every site
          </Button>
        </EmptyPanel>
      ) : (
        <ListPanel columns={COLUMNS} headings={["Site", "Customer", words.Plural, "Live agreement"]}>
          {shown.map((row) => (
            <li key={row.id} className={`grid grid-cols-1 gap-x-4 gap-y-1.5 px-5 py-4 md:items-center ${ROW_CLASSES} ${COLUMNS}`}>
              <span className="flex flex-col">
                <span className="flex flex-wrap items-center gap-2">
                  <Link href={`/sites/${row.id}`} className={`${LINK} font-display text-[15px] font-semibold tracking-tight text-ink hover:text-action`}>
                    {row.name}
                  </Link>
                  {!row.active && <StatusPill tone="neutral" label="Inactive" />}
                </span>
                {row.address && <span className="text-[12px] text-ink-2">{row.address}</span>}
              </span>
              <Link href={`/customers/${row.customerId}`} className={`${LINK} text-ink-2`}>
                {row.customer}
              </Link>
              <span className="flex flex-col gap-1">
                <EquipmentCell row={row} />
                <span className="text-[12px] text-ink-2">{`${row.assetCount} ${row.assetCount === 1 ? "asset" : "assets"}`}</span>
              </span>
              {row.liveAgreement ? (
                <span className="flex flex-wrap items-center gap-2">
                  <Link href={`/agreements/${row.liveAgreement.id}`} className={`${LINK} font-semibold`}>
                    {row.liveAgreement.number}
                  </Link>
                  {pipelineStage(row.liveAgreement.status) ? (
                    <StatusPill stage={pipelineStage(row.liveAgreement.status)!} label={statusLabel(row.liveAgreement.status)} filled />
                  ) : (
                    <StatusPill tone="neutral" label={statusLabel(row.liveAgreement.status)} />
                  )}
                </span>
              ) : (
                <span className="text-ink-2">No live agreement</span>
              )}
            </li>
          ))}
        </ListPanel>
      )}
    </div>
  );
}
