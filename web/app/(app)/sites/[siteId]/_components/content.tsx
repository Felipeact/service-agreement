"use client";

import Link from "next/link";
import { useRef, useState } from "react";
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
import { SectionPanel } from "@/components/ui/section-panel";
import { StatusPill } from "@/components/ui/status-pill";
import { statusLabel } from "@/domain/agreement";
import { itemVerb } from "@/domain/org-settings";
import { filterAssets, groupAssets } from "./assets";
import { NewAgreementControl } from "./new-agreement";

const value = (text: string | null) => text ?? "-";

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
  const GRID_CLASS = canWrite ? "md:grid-cols-[9rem_6rem_minmax(0,2fr)_minmax(0,2fr)_6rem_3rem]" : "md:grid-cols-[9rem_6rem_minmax(0,2fr)_minmax(0,2fr)_6rem]";
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

  const headerActions = canWrite ? (
    <div className="flex flex-wrap items-start gap-2.5">
      <LinkButton href={`/sites/${site.id}/edit`}>Edit site</LinkButton>
      {canAdd && <LinkButton href={`/sites/${site.id}/import`}>{`Import ${words.singular} list`}</LinkButton>}
      {!site.liveAgreement && canAdd && newAgreement && <NewAgreementControl action={newAgreement} />}
      {addAsset}
    </div>
  ) : undefined;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-6">
        <Link href={`/customers/${site.customerId}`} className="inline-flex min-h-11 items-center gap-1 text-[13px] font-semibold text-action hover:underline lg:min-h-8">
          <span aria-hidden="true">←</span> {site.customerName}
        </Link>
        <PageHeader
          title={site.name}
          badge={
            <span className="flex flex-wrap items-center gap-2">
              {!site.active && <StatusPill tone="neutral" label="Inactive" />}
              {site.liveAgreement && (
                <Link href={`/agreements/${site.liveAgreement.id}`} className="relative inline-flex h-[22px] items-center rounded-full bg-pill-completed px-2.5 text-[11px] font-semibold text-pill-completed-ink after:absolute after:-inset-y-3 after:inset-x-0 hover:underline">
                  {`${site.liveAgreement.number} · ${statusLabel(site.liveAgreement.status)}`}
                </Link>
              )}
            </span>
          }
          subtitle={`${value(site.address)} · Site contact: ${value(site.contactName)} · Approver: ${value(site.approverName ?? null)}`}
          action={headerActions}
        />
      </div>

      {site.assets.length === 0 ? (
        <EmptyPanel title={`No ${words.plural} recorded yet`} text={`${words.Plural} ${itemVerb(words, "appears", "appear")} here once ${itemVerb(words, "it is", "they are")} added or imported.`}>
          {addAsset}
        </EmptyPanel>
      ) : (
        <SectionPanel
          id="site-register"
          title="Register"
          note={`${total} ${total === 1 ? "asset" : "assets"}`}
          flush
          action={
            <div className="flex w-full flex-wrap items-center gap-3 md:w-auto">
              {listed.length > 0 && (
                <SearchInput
                  ref={searchRef}
                  label={`Search ${words.plural}`}
                  placeholder={`Search ${words.plural}…`}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="w-full md:w-56"
                />
              )}
              {toggle}
            </div>
          }
        >
          {listed.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
              <p className="text-[14px] font-semibold">No active assets.</p>
              {toggle}
            </div>
          ) : groups.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
              <p className="text-[14px] font-semibold">{`No ${words.plural} ${itemVerb(words, "matches", "match")} "${query}"`}</p>
              <Button onClick={clearSearch}>Clear search</Button>
            </div>
          ) : (
            <>
              <div aria-hidden="true" className={`hidden h-10 items-center gap-x-3 border-b border-hairline bg-ground/70 px-4 text-[12px] font-semibold text-ink-2 md:grid ${canWrite ? "md:grid-cols-[9rem_6rem_minmax(0,2fr)_minmax(0,2fr)_6rem_3rem]" : "md:grid-cols-[9rem_6rem_minmax(0,2fr)_minmax(0,2fr)_6rem]"}`}>
                <span>Type</span>
                <span>Unit</span>
                <span>Model</span>
                <span>Location</span>
                <span>Source</span>
                {canWrite && <span />}
              </div>
              {groups.map((group) => (
                <section key={group.code} aria-label={group.heading}>
                  <h2 className="sr-only">
                    {group.heading}<span className="ml-2">{group.count}</span>
                  </h2>
                  <ul className="divide-y divide-hairline border-b border-hairline last:border-b-0">
                    {group.rows.map((asset) => (
                      <li
                        key={asset.id}
                        className={`grid grid-cols-2 gap-x-3 gap-y-1 px-4 py-3 md:items-center ${GRID_CLASS}`}
                      >
                        <span className="col-span-2 text-[12px] font-semibold text-ink-2 md:col-span-1 md:text-[14px] md:font-medium md:text-ink">{group.heading.replace(/^[^-]*-\s*/, "")}</span>
                        <span className="flex flex-wrap items-center gap-2 font-semibold">
                          {value(asset.unitNo)}
                          {!asset.active && <StatusPill tone="neutral" label={asset.replacedBy ? `Removed · replaced by ${asset.replacedBy}` : "Removed"} />}
                        </span>
                        <span className="col-span-2 text-ink-nav md:col-span-1">{value(asset.typeModel)}</span>
                        <span className="col-span-2 text-ink-2 md:col-span-1">{value(asset.location)}</span>
                        <span className="col-start-2 row-start-2 text-right md:col-start-auto md:row-start-auto md:text-left">
                          <StatusPill tone={asset.source === "import" ? "attention" : "neutral"} label={asset.source === "import" ? "Imported" : "Manual"} />
                        </span>
                        {canWrite && (
                          <Link href={`/assets/${asset.id}/edit`} aria-label={`Edit ${asset.unitNo ?? group.heading}`} className="inline-flex min-h-11 items-center font-medium text-action lg:min-h-0 md:justify-end">
                            Edit
                          </Link>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </>
          )}
        </SectionPanel>
      )}
    </div>
  );
}
