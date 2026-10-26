"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import type { MemberRole, SiteView } from "@/application/ports";
import { canWriteRecords } from "@/components/records/state";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { EmptyPanel } from "@/components/ui/empty-panel";
import { LinkButton } from "@/components/ui/link-button";
import { SearchInput } from "@/components/ui/search-input";
import { StatusPill } from "@/components/ui/status-pill";
import { filterAssets, groupAssets } from "./assets";

const value = (text: string | null) => text ?? "-";

type SiteRegisterViewProps = {
  site: SiteView;
  initialQuery?: string;
  /** Decides whether the edit and add controls show; without a role the register is read-only. */
  role?: MemberRole;
};

/** The site page body: who and where, then the equipment grouped by type. */
export function SiteRegisterView({ site, initialQuery = "", role }: SiteRegisterViewProps) {
  const [query, setQuery] = useState(initialQuery);
  const searchRef = useRef<HTMLInputElement>(null);
  const groups = groupAssets(filterAssets(site.assets, query));
  const total = site.assets.length;
  const canWrite = role !== undefined && canWriteRecords(role);
  const addAsset = canWrite && (
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
          badge={<StatusPill tone="neutral" label={`${total} ${total === 1 ? "asset" : "assets"}`} />}
          controls={
            total > 0 ? (
              <SearchInput
                ref={searchRef}
                label="Search equipment"
                placeholder="Search equipment…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="w-full md:w-60"
              />
            ) : undefined
          }
          action={
            canWrite ? (
              <div className="flex flex-wrap gap-2.5">
                <LinkButton href={`/sites/${site.id}/edit`}>Edit site</LinkButton>
                <LinkButton href={`/sites/${site.id}/import`}>Import equipment list</LinkButton>
                {addAsset}
              </div>
            ) : undefined
          }
        />
        <p className="text-[13px] text-ink-2">
          {value(site.address)} · Site contact: {value(site.contactName)}
        </p>
      </div>

      {total === 0 ? (
        <EmptyPanel title="No equipment recorded yet" text="Equipment appears here once it is added or imported.">
          {addAsset}
        </EmptyPanel>
      ) : groups.length === 0 ? (
        <EmptyPanel title={`No equipment matches "${query}"`}>
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
                  <span className="font-semibold">{value(asset.unitNo)}</span>
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
