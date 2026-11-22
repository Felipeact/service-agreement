"use client";

import Link from "next/link";
import { useRef, useState, type ReactNode } from "react";
import type { MemberRole, SiteView } from "@/application/ports";
import type { CreateAgreementState } from "@/components/agreements/state";
import { ShowInactiveToggle } from "@/components/records/show-inactive";
import { canWriteRecords } from "@/components/records/state";
import { useItemWords } from "@/components/shell/item-words";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { EmptyPanel } from "@/components/ui/empty-panel";
import { LinkButton } from "@/components/ui/link-button";
import { SearchInput } from "@/components/ui/search-input";
import { StatusPill } from "@/components/ui/status-pill";
import { statusLabel } from "@/domain/agreement";
import { initialsOf } from "@/lib/initials";
import { itemVerb } from "@/domain/org-settings";
import { filterAssets, groupAssets } from "./assets";
import { NewAgreementControl } from "./new-agreement";

const value = (text: string | null) => text ?? "-";

/** One cell of the site's title block: a small label over a figure. */
function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 px-4 py-3 sm:px-5">
      <dt className="text-[12px] font-medium text-ink-2">{label}</dt>
      <dd className="truncate text-[20px] leading-7 font-semibold tracking-tight tabular-nums">{children}</dd>
    </div>
  );
}

type SiteRegisterViewProps = {
  site: SiteView;
  initialQuery?: string;
  /** Decides whether the edit and add controls show; without a role the register is read-only. */
  role?: MemberRole;
  /** `createAgreementAction` bound to this site; shown to writers while the site has no live agreement. */
  newAgreement?: () => Promise<CreateAgreementState>;
  /** `?show=inactive`: list removed assets too (deactivation door 8). */
  showInactive?: boolean;
};

/** The site page body: who and where, then the equipment grouped by type. */
export function SiteRegisterView({ site, initialQuery = "", role, newAgreement, showInactive = false }: SiteRegisterViewProps) {
  const words = useItemWords();
  const [query, setQuery] = useState(initialQuery);
  const searchRef = useRef<HTMLInputElement>(null);
  const listed = showInactive ? site.assets : site.assets.filter((asset) => asset.active);
  const groups = groupAssets(filterAssets(listed, query));
  const total = site.assets.filter((asset) => asset.active).length;
  const canWrite = role !== undefined && canWriteRecords(role);
  // An inactive site takes no new equipment and starts no agreement (deactivation AC 13).
  const canAdd = canWrite && site.active;
  const toggle = <ShowInactiveToggle href={`/sites/${site.id}`} showing={showInactive} />;
  const addAsset = canAdd && (
    <LinkButton href={`/sites/${site.id}/assets/new`} variant="primary">
      Add asset
    </LinkButton>
  );

  function clearSearch() {
    setQuery("");
    searchRef.current?.focus();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Link href={`/customers/${site.customerId}`} className="inline-flex min-h-11 items-center text-[13px] font-medium text-action lg:min-h-0">
          {site.customerName}
        </Link>
        <PageHeader
          title={site.name}
          badge={
            <span className="flex flex-wrap items-center gap-2">
              {!site.active && <StatusPill tone="neutral" label="Inactive" />}
              <StatusPill tone="neutral" label={`${total} ${total === 1 ? "asset" : "assets"}`} />
            </span>
          }
          controls={
            site.assets.length > 0 ? (
              <div className="flex w-full flex-wrap items-center gap-3 md:w-auto">
                {listed.length > 0 && (
                  <SearchInput
                    ref={searchRef}
                    label={`Search ${words.plural}`}
                    placeholder={`Search ${words.plural}…`}
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    className="w-full md:w-60"
                  />
                )}
                {toggle}
              </div>
            ) : undefined
          }
          action={
            canWrite ? (
              <div className="flex flex-wrap gap-2.5">
                <LinkButton href={`/sites/${site.id}/edit`}>Edit site</LinkButton>
                {canAdd && <LinkButton href={`/sites/${site.id}/import`}>{`Import ${words.singular} list`}</LinkButton>}
                {addAsset}
              </div>
            ) : undefined
          }
        />
        <div className="flex flex-col overflow-hidden rounded-panel border border-hairline bg-surface shadow-card md:flex-row">
          <div className="flex items-center gap-3 border-b border-hairline bg-night px-4 py-3 text-surface sm:px-5 md:w-56 md:shrink-0 md:border-r md:border-b-0 md:py-4">
            <span aria-hidden="true" className="inline-flex size-11 shrink-0 items-center justify-center rounded-control bg-action text-[15px] font-semibold shadow-[inset_0_1px_0_rgb(255_255_255/0.2)]">
              {initialsOf(site.name)}
            </span>
            <span className="flex min-w-0 flex-col leading-tight">
              <span className="text-[12px] text-night-ink">{site.active ? "Active site" : "Inactive site"}</span>
              <span className="truncate text-[14px] font-semibold">{site.name}</span>
            </span>
          </div>
          <dl className="grid flex-1 grid-cols-3 divide-x divide-hairline">
            <Fact label={words.Plural}>{total}</Fact>
            <Fact label="Types">{groupAssets(site.assets.filter((asset) => asset.active)).length}</Fact>
            <Fact label="Agreement">{site.liveAgreement ? site.liveAgreement.number : "None"}</Fact>
          </dl>
        </div>
        <p className="text-[13px] text-ink-2">
          {value(site.address)} · Site contact: {value(site.contactName)} · Approver: {value(site.approverName ?? null)}
        </p>
        {site.liveAgreement ? (
          <p className="text-[13px] text-ink-2">
            Agreement:{" "}
            <Link href={`/agreements/${site.liveAgreement.id}`} className="inline-flex min-h-11 items-center font-semibold text-action lg:min-h-0">
              {`${site.liveAgreement.number} · ${statusLabel(site.liveAgreement.status)}`}
            </Link>
          </p>
        ) : (
          canAdd && newAgreement && <NewAgreementControl action={newAgreement} />
        )}
      </div>

      {site.assets.length === 0 ? (
        <EmptyPanel title={`No ${words.plural} recorded yet`} text={`${words.Plural} ${itemVerb(words, "appears", "appear")} here once ${itemVerb(words, "it is", "they are")} added or imported.`}>
          {addAsset}
        </EmptyPanel>
      ) : listed.length === 0 ? (
        <EmptyPanel title="No active assets.">{toggle}</EmptyPanel>
      ) : groups.length === 0 ? (
        <EmptyPanel title={`No ${words.plural} ${itemVerb(words, "matches", "match")} "${query}"`}>
          <Button onClick={clearSearch}>Clear search</Button>
        </EmptyPanel>
      ) : (
        groups.map((group) => (
          <section key={group.code} aria-label={group.heading} className="overflow-hidden rounded-panel border border-hairline bg-surface">
            <h2 className="flex items-center gap-2 border-b border-hairline bg-ground px-4 py-2 text-[13px] font-semibold">
              {group.heading}
              <span className="font-medium text-ink-2">{group.count}</span>
            </h2>
            <ul className="divide-y divide-hairline">
              {group.rows.map((asset) => (
                <li
                  key={asset.id}
                  className={`grid grid-cols-2 gap-x-3 gap-y-1 px-4 py-2.5 md:items-center ${canWrite ? "md:grid-cols-[6rem_minmax(0,2fr)_minmax(0,2fr)_6rem_3rem]" : "md:grid-cols-[6rem_minmax(0,2fr)_minmax(0,2fr)_6rem]"}`}
                >
                  <span className="flex flex-wrap items-center gap-2 font-semibold">
                    {value(asset.unitNo)}
                    {!asset.active && <StatusPill tone="neutral" label={asset.replacedBy ? `Removed · replaced by ${asset.replacedBy}` : "Removed"} />}
                  </span>
                  <span className="col-span-2 text-ink-2 md:col-span-1">{value(asset.typeModel)}</span>
                  <span className="col-span-2 text-ink-2 md:col-span-1">{value(asset.location)}</span>
                  <span className="col-start-2 row-start-1 text-right text-ink-2 md:col-start-auto md:row-start-auto md:text-left">
                    {asset.source === "import" ? "Imported" : "Manual"}
                  </span>
                  {canWrite && (
                    <Link
                      href={`/assets/${asset.id}/edit`}
                      aria-label={`Edit ${asset.unitNo ?? group.heading}`}
                      className="inline-flex min-h-11 items-center font-medium text-action lg:min-h-0 md:justify-end"
                    >
                      Edit
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
