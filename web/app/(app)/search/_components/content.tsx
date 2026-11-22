import Link from "next/link";
import type { ReactNode } from "react";
import type { SearchGroup, SearchResults } from "@/application/ports";
import { SEARCH_GROUP_LIMIT, SEARCH_MAX } from "@/domain/records";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { EmptyPanel } from "@/components/ui/empty-panel";
import { SearchInput } from "@/components/ui/search-input";
import { DEFAULT_ITEM_WORDS, itemText, type ItemWords } from "@/domain/org-settings";

const ROW = "flex min-h-11 min-w-0 flex-col justify-center gap-0.5 px-4 py-2 hover:bg-ground lg:min-h-0";
const TITLE = "text-[13px] font-semibold break-words text-action";
const DETAIL = "flex min-w-0 flex-wrap gap-x-2 text-[12px] break-words text-ink-2";

function Group<T extends { id: string }>({ title, group, row }: { title: string; group: SearchGroup<T>; row: (hit: T) => ReactNode }) {
  if (group.hits.length === 0) return null;
  const id = `search-${title.toLowerCase()}`;
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2">
      <h2 id={id} className="flex items-baseline gap-2 text-[13px] font-semibold">
        {title}
        <span className="font-normal text-ink-2">{group.hits.length}</span>
      </h2>
      <ul className="divide-y divide-hairline overflow-hidden rounded-panel border border-hairline bg-surface">
        {group.hits.map((hit) => (
          <li key={hit.id}>{row(hit)}</li>
        ))}
      </ul>
      {group.more && <p className="text-[12px] text-ink-2">{`Showing the first ${SEARCH_GROUP_LIMIT}. Refine your search.`}</p>}
    </section>
  );
}

/** The search page: its own field, then Customers, Sites and Equipment, or the prompt, or the no-match panel (global-search S1 to S3). */
export function SearchView({ query, results, words = DEFAULT_ITEM_WORDS }: { query: string; results: SearchResults | null; words?: ItemWords }) {
  const empty = results !== null && results.customers.hits.length + results.sites.hits.length + results.equipment.hits.length === 0;
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Search" />
      <form method="get" action="/search" role="search" className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <SearchInput label="Search" name="q" defaultValue={query} maxLength={SEARCH_MAX} placeholder="Name, address or unit number" className="sm:w-96" />
        <Button type="submit" variant="primary">
          Search
        </Button>
      </form>

      {results === null ? (
        <EmptyPanel title={itemText("Search customers, sites and equipment by name, address or unit number.", words)} />
      ) : empty ? (
        <EmptyPanel title={`${itemText("No customers, sites or equipment match “", words)}${query}”.`} text="Deactivated records are not searched." />
      ) : (
        <div className="flex flex-col gap-5">
          <Group
            title="Customers"
            group={results.customers}
            row={(hit) => (
              <Link href={`/customers/${hit.id}`} className={ROW}>
                <span className={TITLE}>{hit.name}</span>
              </Link>
            )}
          />
          <Group
            title="Sites"
            group={results.sites}
            row={(hit) => (
              <Link href={`/sites/${hit.id}`} className={ROW}>
                <span className={TITLE}>{hit.name}</span>
                <span className={DETAIL}>
                  <span>{hit.customerName}</span>
                  {hit.address && <span>{hit.address}</span>}
                </span>
              </Link>
            )}
          />
          <Group
            title={words.Plural}
            group={results.equipment}
            row={(hit) => (
              <Link href={`/sites/${hit.siteId}`} className={ROW}>
                <span className={TITLE}>{hit.unitNo}</span>
                <span className={DETAIL}>
                  <span>{hit.typeName}</span>
                  <span>{hit.siteName}</span>
                  <span>{hit.customerName}</span>
                </span>
              </Link>
            )}
          />
        </div>
      )}
    </div>
  );
}
