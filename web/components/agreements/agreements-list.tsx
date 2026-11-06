"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import type { AgreementListRow, MemberRole } from "@/application/ports";
import { statusLabel, STATUS_FILTER_VALUES, type AgreementFilter, type StatusFilterValue } from "@/domain/agreement";
import { followUpLabel, isClosedStage, pipelineStage, type PipelineStage } from "@/domain/pipeline";
import { canWriteRecords } from "@/components/records/state";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { EmptyPanel } from "@/components/ui/empty-panel";
import { Icon, type IconName } from "@/components/ui/icons";
import { Spot } from "@/components/ui/illustrations";
import { LinkButton } from "@/components/ui/link-button";
import { ListPanel, ROW_CLASSES } from "@/components/ui/list-panel";
import { SearchInput } from "@/components/ui/search-input";
import { StatusPill } from "@/components/ui/status-pill";
import { formatCad } from "@/lib/money";

const COLUMNS = "md:grid-cols-[minmax(0,2.6fr)_minmax(0,1.5fr)_7rem_6rem_1.5rem]";

const FILTER_LABELS: Record<StatusFilterValue, string> = {
  in_progress: "In progress",
  sent: "Sent",
  accepted: "Accepted",
  completed: "Completed",
  refused: "Refused",
  expired: "Expired",
  withdrawn: "Withdrawn",
};

type Props = {
  rows: AgreementListRow[];
  /** The filter the page was opened with (`?status=`, `?site=`, `?expiring=1`); the page's own server-side narrowing. */
  filter: AgreementFilter;
  /** Decides whether New agreement shows; without a role the page is read-only. */
  role?: MemberRole;
  /** Replaces the plain New agreement link, e.g. with the dialog that starts one (the page supplies it for writers). */
  newAgreement?: ReactNode;
  /** The moment the ages are counted from. */
  now?: Date;
};

/** `/agreements` with the filter's site kept; `status` and `expiring` are replaced by the arguments. */
function agreementsHref(filter: AgreementFilter, status?: StatusFilterValue, expiring = false): string {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (filter.siteId) params.set("site", filter.siteId);
  if (expiring) params.set("expiring", "1");
  const query = params.toString();
  return query ? `/agreements?${query}` : "/agreements";
}

const DAY_MS = 86_400_000;

/** Whole days since the agreement last changed. */
function ageDays(row: AgreementListRow, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - Date.parse(row.updatedAt)) / DAY_MS));
}

/** One summary card: a small label with its icon over a big figure and a line of context. */
function Stat({ label, icon, value, note }: { label: string; icon: IconName; value: string; note: string }) {
  return (
    <div className="flex flex-col gap-2.5 rounded-panel border border-hairline bg-surface p-5 shadow-card">
      <div className="flex items-center justify-between text-ink-2">
        <span className="text-[13px] font-medium">{label}</span>
        <Icon name={icon} className="size-[18px]" />
      </div>
      <span className="font-display text-[30px] leading-none font-medium tracking-tight text-ink">{value}</span>
      <span className="text-[12px] text-ink-2">{note}</span>
    </div>
  );
}

/**
 * The Agreements page body: a header, four summary cards, a segmented status filter beside the search, then one row per
 * agreement (agreements-page S1). The status and expiring filters are links, so the filter lives in the URL; the search
 * narrows the rows on the page.
 */
export function AgreementsListView({ rows, filter, role, newAgreement: newAgreementSlot, now = new Date() }: Props) {
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const filtered = Boolean(filter.status || filter.siteId || filter.expiring);
  const shown = needle ? rows.filter((row) => [row.number ?? "", row.site, row.customer].some((text) => text.toLowerCase().includes(needle))) : rows;

  const stageOf = (row: AgreementListRow): PipelineStage | null => pipelineStage(row.status);
  const isStale = (row: AgreementListRow) => {
    const stage = stageOf(row);
    if (!stage || isClosedStage(stage)) return false;
    const attention = row.status === "changes_requested" ? "Changes requested" : undefined;
    return Boolean(attention) || followUpLabel({ stage, ageDays: ageDays(row, now) }) !== null;
  };
  const withCustomer = rows.filter((row) => stageOf(row) === "sent").length;
  const needFollowUp = rows.filter(isStale).length;
  const openCents = rows.reduce((sum, row) => {
    const stage = stageOf(row);
    return sum + (stage && !isClosedStage(stage) ? (row.annualCents ?? 0) : 0);
  }, 0);
  const wonCents = rows.reduce((sum, row) => sum + (row.status === "accepted" && row.annualCents ? row.annualCents : 0), 0);

  const canCreate = Boolean(role && canWriteRecords(role));
  const newAgreement =
    canCreate &&
    (newAgreementSlot ?? (
      <LinkButton href="/agreements/new" variant="primary">
        <Icon name="plus" className="size-4" />
        New agreement
      </LinkButton>
    ));

  const segments: { label: string; href: string; active: boolean }[] = [
    { label: "All", href: agreementsHref({ ...filter, status: undefined }, undefined, filter.expiring), active: !filter.status },
    ...STATUS_FILTER_VALUES.map((value) => ({ label: FILTER_LABELS[value], href: agreementsHref(filter, value, filter.expiring), active: filter.status === value })),
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Agreements" subtitle="Track every agreement from first draft through customer decision and countersignature." action={newAgreement || undefined} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <Stat label="Agreements" icon="document" value={String(rows.length)} note={filtered ? "Matching this view" : "In your workspace"} />
        <Stat label="With customer" icon="mail" value={String(withCustomer)} note="Sent, no decision yet" />
        <Stat label="Need follow-up" icon="bell" value={String(needFollowUp)} note="Changes asked, or sat too long" />
        <Stat label="Open value" icon="trend" value={formatCad(openCents)} note={`${formatCad(wonCents)}/yr accepted`} />
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <nav aria-label="Filter by status" className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:px-0">
          <div className="inline-flex gap-1 rounded-control bg-board p-1">
            {segments.map((segment) => (
              <Link
                key={segment.label}
                href={segment.href}
                aria-current={segment.active ? "true" : undefined}
                className={`inline-flex h-11 shrink-0 items-center rounded-[6px] px-3.5 text-[13px] font-medium whitespace-nowrap transition-colors duration-150 lg:h-8 ${
                  segment.active ? "bg-surface font-semibold text-ink shadow-card" : "text-ink-2 hover:text-ink"
                }`}
              >
                {segment.label}
              </Link>
            ))}
          </div>
        </nav>
        <div className="flex items-center gap-2.5">
          <Link
            href={agreementsHref(filter, filter.status, !filter.expiring)}
            aria-current={filter.expiring ? "true" : undefined}
            className={`inline-flex h-11 shrink-0 items-center gap-2 rounded-control border px-3.5 text-[13px] font-medium whitespace-nowrap transition-colors duration-150 lg:h-[34px] ${
              filter.expiring ? "border-action bg-action-tint text-action" : "border-hairline bg-surface text-ink hover:bg-ground"
            }`}
          >
            <Icon name="calendar" className="size-4" />
            Expiring soon
          </Link>
          <SearchInput label="Search agreements" placeholder="Search this list…" value={query} onChange={(event) => setQuery(event.target.value)} className="min-w-0 flex-1 md:w-60 md:flex-none" />
        </div>
      </div>

      {filter.siteId && (
        <p className="flex flex-wrap items-center gap-2 text-[13px] text-ink-2">
          Showing one site.
          <Link href={agreementsHref({ ...filter, siteId: undefined }, filter.status, filter.expiring)} className="inline-flex min-h-11 items-center font-medium text-action lg:min-h-0">
            Show every site
          </Link>
        </p>
      )}

      {rows.length === 0 ? (
        filtered ? (
          <EmptyPanel title="No agreements match these filters." text="Try a different status, or clear the filters.">
            <LinkButton href="/agreements">Clear filters</LinkButton>
          </EmptyPanel>
        ) : (
          <EmptyPanel title="No agreements yet" text="Agreements you create appear here." art={<Spot kind="clipboard" />}>
            {newAgreement}
          </EmptyPanel>
        )
      ) : shown.length === 0 ? (
        <EmptyPanel title={`No agreements match "${query}"`}>
          <Button onClick={() => setQuery("")}>Clear search</Button>
        </EmptyPanel>
      ) : (
        <ListPanel columns={COLUMNS} headings={["Agreement", "Status", "Value", "Age", ""]}>
          {shown.map((row) => {
            const stage = stageOf(row);
            const days = ageDays(row, now);
            const stale = isStale(row);
            return (
              <li key={row.id}>
                <Link href={`/agreements/${row.id}`} className={`grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 px-5 py-4 ${ROW_CLASSES} ${COLUMNS}`}>
                  <span className="flex min-w-0 flex-col">
                    <span className="font-display text-[15px] font-semibold tracking-tight text-ink">{row.site}</span>
                    <span className="text-[12px] text-ink-2">{`${row.customer} · ${row.number ?? "Draft"} · v${row.versionNo}`}</span>
                  </span>
                  <span className="col-span-2 flex flex-wrap items-center gap-x-2 gap-y-1 md:col-span-1">
                    {stage ? <StatusPill stage={stage} label={statusLabel(row.status)} filled /> : <StatusPill tone="neutral" label={statusLabel(row.status)} />}
                    {row.termEnd && <span className="text-[12px] text-ink-2">{`Ends ${row.termEnd}`}</span>}
                  </span>
                  <span className="font-semibold text-ink">{row.annualCents === null ? "" : `${formatCad(row.annualCents)}/yr`}</span>
                  <span title={`Updated ${days} ${days === 1 ? "day" : "days"} ago`} className={`inline-flex items-center gap-1 text-[12px] ${stale ? "font-semibold text-danger" : "text-ink-2"}`}>
                    <Icon name="clock" className="size-3.5" />
                    {days === 0 ? "today" : `${days} ${days === 1 ? "day" : "days"}`}
                  </span>
                  <Icon name="chevron" className="hidden size-4 text-ink-2 md:block" />
                </Link>
              </li>
            );
          })}
        </ListPanel>
      )}
    </div>
  );
}
