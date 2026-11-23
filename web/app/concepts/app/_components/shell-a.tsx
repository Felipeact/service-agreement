import Link from "next/link";
import { BellIcon, SearchIcon } from "lucide-react";
import type { ReactNode } from "react";
import { ProductMark } from "@/components/ui/product-mark";
import { COMPANY } from "./data";
import { Account, NAV, NavList, Quota, screenHref, type NavKey } from "./shell-parts";
import { MobileMenu, UserMenu } from "./shell-client";

const LINK = "inline-flex min-h-11 items-center rounded-lg px-3 text-[14px] font-medium transition-colors xl:min-h-10";

/** The public hero's wash and grid, behind the top of the page. */
export function Wash({ strong = false }: { strong?: boolean }) {
  const opacity = strong ? { blue: "bg-action/25", cyan: "bg-cyan-400/25" } : { blue: "bg-action/12", cyan: "bg-cyan-400/12" };
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] overflow-hidden">
      <div className={`absolute -top-40 left-[6%] size-[440px] rounded-full ${opacity.blue} blur-[100px]`} />
      <div className={`absolute -top-32 right-[8%] size-[400px] rounded-full ${opacity.cyan} blur-[110px]`} />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(15,23,42,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(15,23,42,0.03)_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:radial-gradient(ellipse_80%_80%_at_50%_0%,#000_35%,transparent_100%)]" />
    </div>
  );
}

/**
 * Design A, "Light Rail": the public site's frosted header carried into the app as the navigation. There is no sidebar, so the
 * work gets the whole width; below 1280px the links fold into a menu.
 */
export function ShellA({ active, children }: { active: NavKey | null; children: ReactNode }) {
  return (
    <div className="relative isolate min-h-dvh bg-linear-to-b from-[#f8f9ff] to-surface">
      <Wash />
      <header className="sticky top-0 z-30 border-b border-hairline bg-surface/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-2 px-4 sm:px-6 lg:px-8">
          <Link href={screenHref("pipeline")} aria-label="Service Pacts, Pipeline" className="mr-2 flex min-h-11 items-center gap-2.5 rounded-lg">
            <ProductMark className="size-9 rounded-xl shadow-md shadow-action/20" />
            <span className="text-[18px] font-bold tracking-tight">Service Pacts</span>
          </Link>
          <span aria-hidden="true" className="hidden h-6 w-px bg-hairline 2xl:block" />
          <span className="hidden truncate text-[13px] font-medium text-ink-nav 2xl:block">{COMPANY.name}</span>

          <nav aria-label="Main" className="ml-3 hidden items-center gap-0.5 xl:flex">
            {NAV.map((item) => {
              const current = item.key === active;
              return (
                <Link key={item.key} href={screenHref(item.slug)} aria-current={current ? "page" : undefined} className={`${LINK} ${current ? "bg-action-tint font-semibold text-action-press" : "text-ink-nav hover:bg-board hover:text-ink"}`}>
                  {item.label.split(" & ")[0]}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-1">
            <Link href={screenHref("search")} aria-label="Search" className="inline-flex h-11 items-center gap-2 rounded-xl text-ink-nav hover:bg-board max-sm:w-11 max-sm:justify-center sm:border sm:border-hairline sm:bg-surface sm:px-3 sm:text-[13px] sm:shadow-card lg:h-10">
              <SearchIcon aria-hidden="true" className="size-4" />
              <span className="hidden sm:inline">Search</span>
              <kbd className="hidden rounded border border-hairline bg-ground px-1.5 text-[11px] text-ink-2 lg:inline">⌘K</kbd>
            </Link>
            <Link href={`${screenHref("pipeline")}?followups=1`} aria-label="1 agreement needs follow-up" className="relative inline-flex size-11 items-center justify-center rounded-xl text-ink-2 hover:bg-board hover:text-ink lg:size-10">
              <BellIcon aria-hidden="true" className="size-[18px]" />
              <span aria-hidden="true" className="absolute top-2.5 right-2.5 size-2 rounded-full bg-danger ring-2 ring-surface" />
            </Link>
            <UserMenu />
            <MobileMenu hideFrom="xl">
              <nav aria-label="Menu" className="menu-pop absolute right-0 z-40 mt-2 flex w-72 flex-col gap-2 rounded-panel border border-hairline bg-surface p-2 shadow-float">
                <NavList active={active} />
                <Quota />
                <Account />
              </nav>
            </MobileMenu>
          </div>
        </div>
      </header>
      <main className="mx-auto flex max-w-[1400px] flex-col gap-6 px-4 pt-7 pb-16 sm:px-6 lg:px-8 lg:pt-10">{children}</main>
    </div>
  );
}

