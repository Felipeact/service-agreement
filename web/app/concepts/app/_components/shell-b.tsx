import Link from "next/link";
import { BellIcon, SearchIcon } from "lucide-react";
import type { ReactNode } from "react";
import { ProductMark } from "@/components/ui/product-mark";
import { NewAgreementButton } from "./new-agreement";
import { Account, NavList, Quota, SearchField, Workspace, screenHref, type NavKey } from "./shell-parts";
import { MobileMenu, UserMenu } from "./shell-client";

/**
 * The chosen staff-app design, "Floating Panel": a white sidebar floating on the pale ground, a soft top bar with search,
 * the New agreement button and the account menu, and the public hero's wash behind the page. A frosted bar and a menu below 1024px.
 */
export function ShellB({ active, children }: { active: NavKey | null; children: ReactNode }) {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="sticky top-0 z-20 hidden h-dvh p-3 lg:block">
        <div className="flex h-full flex-col gap-3 rounded-panel border border-hairline bg-surface p-3 shadow-card">
          <Workspace />
          <SearchField />
          <nav aria-label="Main" className="min-h-0 flex-1 overflow-y-auto"><NavList active={active} /></nav>
          <Quota />
          <Account />
        </div>
      </aside>

      <div className="relative isolate min-w-0">
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] overflow-hidden">
          <div className="absolute -top-40 left-[6%] size-[440px] rounded-full bg-action/10 blur-[100px]" />
          <div className="absolute -top-32 right-[8%] size-[400px] rounded-full bg-cyan-400/10 blur-[110px]" />
          <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(15,23,42,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(15,23,42,0.03)_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:radial-gradient(ellipse_80%_80%_at_50%_0%,#000_35%,transparent_100%)]" />
        </div>

        <div className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-hairline bg-surface/80 px-3 backdrop-blur-md sm:px-6 lg:border-0 lg:bg-ground/70 lg:px-8">
          <Link href={screenHref("pipeline")} aria-label="Service Pacts, Pipeline" className="flex min-h-11 items-center gap-2 lg:hidden">
            <ProductMark className="size-8 rounded-lg shadow-md shadow-action/20" />
            <span className="text-[17px] font-bold tracking-tight">Service Pacts</span>
          </Link>
          <form method="get" action={screenHref("search")} role="search" className="relative hidden w-full max-w-md flex-1 lg:block">
            <SearchIcon aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-ink-2" />
            <input type="search" name="q" aria-label="Search" placeholder="Search customers, sites, agreements" className="h-10 w-full rounded-control border border-field bg-surface pr-12 pl-8 text-[13px] text-ink" />
            <kbd aria-hidden="true" className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 rounded-[4px] border border-hairline bg-ground px-1.5 text-[11px] text-ink-2">⌘K</kbd>
          </form>
          <div className="ml-auto flex items-center gap-1">
            <span className="mr-1 hidden rounded-full border border-violet-200 bg-violet-50 px-3.5 py-1.5 text-[12px] font-semibold text-violet-700 xl:inline-block">Ask AI</span>
            <Link href={screenHref("search")} aria-label="Search" className="inline-flex size-11 items-center justify-center rounded-control text-ink hover:bg-board lg:hidden">
              <SearchIcon aria-hidden="true" className="size-[18px]" />
            </Link>
            <Link href={`${screenHref("pipeline")}?followups=1`} aria-label="1 agreement needs follow-up" className="relative inline-flex size-11 items-center justify-center rounded-control text-ink-2 hover:bg-board hover:text-ink lg:size-9">
              <BellIcon aria-hidden="true" className="size-[18px]" />
              <span aria-hidden="true" className="absolute top-2.5 right-2.5 size-2 rounded-full bg-danger ring-2 ring-surface lg:top-2 lg:right-2" />
            </Link>
            <span className="hidden sm:block"><NewAgreementButton /></span>
            <UserMenu />
            <MobileMenu>
              <nav aria-label="Menu" className="menu-pop absolute right-0 z-40 mt-2 flex w-72 flex-col gap-2 rounded-panel border border-hairline bg-surface p-2 shadow-float">
                <NavList active={active} />
                <Quota />
                <Account />
              </nav>
            </MobileMenu>
          </div>
        </div>

        <main className="flex flex-col gap-6 px-4 pt-5 pb-16 md:px-6 lg:px-8 lg:pt-3">{children}</main>
      </div>
    </div>
  );
}
