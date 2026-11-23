import Link from "next/link";
import { BellIcon, SearchIcon, SettingsIcon } from "lucide-react";
import type { ReactNode } from "react";
import { ProductMark } from "@/components/ui/product-mark";
import { COMPANY } from "./data";
import { NewAgreementButton } from "./new-agreement";
import { NAV, screenHref, type NavKey } from "./shell-parts";
import { Wash } from "./shell-a";

const RAIL = "relative flex w-[68px] flex-col items-center gap-1 rounded-xl py-2 text-[10.5px] font-semibold transition-colors";

/** The short name an icon carries under it in the rail. */
const shortName = (label: string) => label.split(" & ")[0].replace("Agreements", "Deals");

function Rail({ active }: { active: NavKey | null }) {
  return (
    <aside className="relative z-20 hidden lg:block">
      <div className="sticky top-0 flex h-dvh flex-col items-center gap-1 border-r border-hairline bg-surface py-4">
        <Link href={screenHref("pipeline")} aria-label="Service Pacts, Pipeline" className="mb-3 rounded-xl">
          <ProductMark className="size-10 rounded-xl shadow-md shadow-action/20" />
        </Link>
        <nav aria-label="Main" className="flex flex-col items-center gap-0.5">
          {NAV.map((item) => {
            const current = item.key === active;
            return (
              <Link key={item.key} href={screenHref(item.slug)} aria-label={item.label} aria-current={current ? "page" : undefined} className={`${RAIL} ${current ? "bg-action-tint text-action-press" : "text-ink-2 hover:bg-board hover:text-ink"}`}>
                {current && <span aria-hidden="true" className="absolute top-1/2 -left-2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-action" />}
                <item.icon aria-hidden="true" className="size-5" strokeWidth={1.9} />
                {shortName(item.label)}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto flex flex-col items-center gap-2">
          <Link href={screenHref("settings")} aria-label="Settings" className={`${RAIL} text-ink-2 hover:bg-board hover:text-ink`}>
            <SettingsIcon aria-hidden="true" className="size-5" />
            Settings
          </Link>
          <span aria-hidden="true" className="inline-flex size-9 items-center justify-center rounded-full bg-linear-to-br from-action to-cyan-500 text-[12px] font-bold text-surface ring-2 ring-surface">
            {COMPANY.initials}
          </span>
        </div>
      </div>
    </aside>
  );
}

/** A phone gets a tab bar in the thumb's reach: three places, a raised New, and Settings. */
function TabBar({ active }: { active: NavKey | null }) {
  const tab = "relative flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition-colors";
  const places = NAV.filter((item) => ["pipeline", "agreements", "customers"].includes(item.key));
  const link = (item: (typeof NAV)[number]) => (
    <Link key={item.key} href={screenHref(item.slug)} aria-current={item.key === active ? "page" : undefined} className={`${tab} ${item.key === active ? "text-action-press" : "text-ink-2"}`}>
      <item.icon aria-hidden="true" className="size-5" strokeWidth={1.9} />
      {shortName(item.label)}
    </Link>
  );
  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-hairline bg-surface/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden">
      {places.slice(0, 2).map(link)}
      <span className="mx-auto -mt-5 self-start">
        <NewAgreementButton label="New agreement" iconOnly className="size-14! rounded-full! px-0! shadow-lg! ring-4 ring-surface" />
      </span>
      {places.slice(2).map(link)}
      <Link href={screenHref("settings")} className={`${tab} text-ink-2`}>
        <SettingsIcon aria-hidden="true" className="size-5" />
        Settings
      </Link>
    </nav>
  );
}

/**
 * Design C, "Aurora Band": a slim icon rail and, on every page, the public hero's glow along the top. The page's own title sits
 * on the glow and its first panel rises over its edge. A phone gets a tab bar instead of the rail.
 */
export function ShellC({ active, children }: { active: NavKey | null; children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-[#f8f9ff] lg:grid lg:grid-cols-[84px_minmax(0,1fr)]">
      <Rail active={active} />
      <div className="relative isolate min-w-0 pb-28 lg:pb-12">
        <div aria-hidden="true" className="absolute inset-x-0 top-0 -z-10 h-[300px] bg-linear-to-b from-blue-50 via-[#f3f7ff] to-transparent" />
        <Wash strong />
        <div className="mx-auto flex max-w-[1400px] flex-col gap-6 px-4 pt-3 sm:px-6 lg:px-10 lg:pt-5">
          <div className="flex items-center gap-2">
            <Link href={screenHref("pipeline")} className="flex size-11 items-center justify-center lg:hidden" aria-label="Service Pacts, Pipeline">
              <ProductMark className="size-8 rounded-lg shadow-md shadow-action/20" />
            </Link>
            <Link href={screenHref("search")} aria-label="Search" className="mx-auto flex h-11 min-w-0 flex-1 items-center gap-2 rounded-full border border-hairline bg-surface px-4 text-[13px] text-ink-2 shadow-float lg:max-w-xl">
              <SearchIcon aria-hidden="true" className="size-4 shrink-0 text-action" />
              <span className="truncate">Search agreements, customers, sites</span>
              <kbd className="ml-auto hidden rounded border border-hairline bg-ground px-1.5 text-[11px] sm:inline">⌘K</kbd>
            </Link>
            <Link href={`${screenHref("pipeline")}?followups=1`} aria-label="1 agreement needs follow-up" className="relative inline-flex size-11 items-center justify-center rounded-control text-ink-2 hover:bg-board hover:text-ink lg:ml-auto">
              <BellIcon aria-hidden="true" className="size-[18px]" />
              <span aria-hidden="true" className="absolute top-2.5 right-2.5 size-2 rounded-full bg-danger ring-2 ring-surface" />
            </Link>
          </div>
          <main className="flex flex-col gap-6">{children}</main>
        </div>
      </div>
      <TabBar active={active} />
    </div>
  );
}

