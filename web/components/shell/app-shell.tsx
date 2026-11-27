"use client";

import { BellIcon, PanelLeftIcon, SearchIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ProductMark } from "@/components/ui/product-mark";
import { SearchInput } from "@/components/ui/search-input";
import { SEARCH_MAX } from "@/domain/records";
import { MobileMenu } from "./disclosure";
import { PlanQuota, type PlanQuotaFigure } from "./plan-quota";
import { SidebarAccount } from "./sidebar-account";
import { UserMenu } from "./user-menu";
import { WorkspaceCard } from "./workspace-card";
import type { ItemWords } from "@/domain/org-settings";
import { ItemWordsProvider } from "./item-words";
import { SidebarNav } from "./sidebar-nav";

const PRODUCT_NAME = "Service Pacts";
const SEARCH_SHORTCUT = "/";
const SIDEBAR_KEY = "sidebar-collapsed";

type AppShellProps = {
  children: ReactNode;
  /** The signed-in member's company, read through RLS. */
  orgName: string;
  email: string;
  signOut: () => Promise<void>;
  /** Agreements that need the estimator, for the bell; 0 shows the bell without a count. */
  followUps?: number;
  /** The New agreement button for the top bar (writers only); its dialog is built on the server. */
  newAgreement?: ReactNode;
  /** The Ask AI button and its panel (the server wires its actions). */
  askAi?: ReactNode;
  /** The org's item words, for the Sites link; the default when absent. */
  words?: ItemWords;
  /** The company's plan has ended: a banner says the workspace is read-only. `canRenew` is true for an owner or admin, who gets the link to Billing. */
  frozen?: { canRenew: boolean };
  /** The member may read Reports (owner, admin or estimator): the sidebar shows the link. */
  reports?: boolean;
  /** The plan includes the API and the member is an owner or admin: the sidebar shows the API link. */
  api?: boolean;
  /** The member's role, shown under their email and in the top bar. */
  role?: string;
  /** The plan and how much of its live-agreement limit is used; absent when the org has no plan or the figure could not be read. */
  plan?: PlanQuotaFigure | null;
  /** A count per nav item `href`, shown as a small badge (open agreements beside Pipeline). */
  counts?: Record<string, number>;
};

/** The bell: a dot on the icon when agreements need follow-up, linking to the Pipeline filtered to them. */
function FollowUpBell({ count }: { count: number }) {
  return (
    <Link
      href="/pipeline?followups=1"
      aria-label={count > 0 ? `${count} ${count === 1 ? "agreement needs" : "agreements need"} follow-up` : "Follow-ups: none due"}
      className="relative inline-flex size-11 items-center justify-center rounded-control text-ink-2 transition-colors duration-150 hover:bg-board hover:text-ink lg:size-9"
    >
      <BellIcon aria-hidden="true" className="size-[18px]" />
      {count > 0 && <span aria-hidden="true" className="absolute top-2.5 right-2.5 size-2 rounded-full bg-danger ring-2 ring-surface lg:top-2 lg:right-2" />}
    </Link>
  );
}

/** The plan's quota card (when there is a plan to show) above the signed-in member's account row. */
function SidebarFooter({ plan, email, role, signOut, full = false }: { plan?: PlanQuotaFigure | null; email: string; role?: string; signOut: () => Promise<void>; full?: boolean }) {
  return (
    <div className="flex flex-col gap-3 pt-3">
      {plan && <PlanQuota {...plan} />}
      <SidebarAccount email={email} role={role} signOut={signOut} full={full} />
    </div>
  );
}

/** A white sidebar floating on the pale ground, a soft top bar with search, the New agreement button and the account menu; below 1024px a frosted bar and a menu. */
export function AppShell({ children, orgName, email, signOut, followUps = 0, newAgreement, askAi, words, frozen, reports, api, role, plan, counts }: AppShellProps) {
  const topSearchRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  // Desktop only: the sidebar slides away to give the work the full width. The choice is remembered per browser.
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(SIDEBAR_KEY) === "1") setCollapsed(true);
    } catch {}
  }, []);

  function toggleSidebar() {
    setCollapsed((was) => {
      try {
        localStorage.setItem(SIDEBAR_KEY, was ? "0" : "1");
      } catch {}
      return !was;
    });
  }

  // "/" jumps to the sidebar search from anywhere, and Ctrl or Cmd + K to the top bar's, unless the visitor is already typing somewhere.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing = target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
      if (event.key === SEARCH_SHORTCUT && !event.metaKey && !event.ctrlKey && !event.altKey) {
        if (typing || collapsed || !searchRef.current || searchRef.current.offsetParent === null) return;
        event.preventDefault();
        searchRef.current.focus();
      } else if ((event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === "b" && window.matchMedia("(min-width: 1024px)").matches) {
        event.preventDefault();
        toggleSidebar();
      } else if ((event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === "k") {
        const field = [topSearchRef.current, searchRef.current].find((node) => node && node.offsetParent !== null);
        if (!field) return;
        event.preventDefault();
        field.focus();
        field.select();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  });

  return (
    <div
      data-app-shell=""
      className={`min-h-dvh lg:grid lg:transition-[grid-template-columns] lg:duration-300 lg:ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none ${
        collapsed ? "lg:grid-cols-[0px_minmax(0,1fr)]" : "lg:grid-cols-[280px_minmax(0,1fr)]"
      }`}
    >
      <aside id="app-sidebar" inert={collapsed} className="sticky top-0 z-20 hidden h-dvh min-w-0 overflow-hidden lg:block">
        <div
          className={`h-full w-[280px] p-3 transition-[opacity,translate] ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-opacity ${
            collapsed ? "-translate-x-6 opacity-0 duration-150" : "translate-x-0 opacity-100 duration-300"
          }`}
        >
        <div className="flex h-full flex-col gap-3 rounded-panel border border-hairline bg-surface p-3 shadow-card">
          <WorkspaceCard orgName={orgName} planName={plan?.planName} />
          <form method="get" action="/search" role="search">
            <SearchInput ref={searchRef} label="Search" name="q" placeholder="Search" maxLength={SEARCH_MAX} />
          </form>
          <SidebarNav words={words} reports={reports} api={api} counts={counts} footer={<SidebarFooter plan={plan} email={email} role={role} signOut={signOut} />} />
        </div>
        </div>
      </aside>

      <div className="relative isolate min-w-0">
        {/* The public hero's soft blue and cyan wash and faint grid, behind the top of every page. */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] overflow-hidden">
          <div className="absolute -top-40 left-[6%] size-[440px] rounded-full bg-action/10 blur-[100px]" />
          <div className="absolute -top-32 right-[8%] size-[400px] rounded-full bg-cyan-400/10 blur-[110px]" />
          <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(15,23,42,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(15,23,42,0.03)_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:radial-gradient(ellipse_80%_80%_at_50%_0%,#000_35%,transparent_100%)]" />
        </div>

        <div className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-hairline bg-surface/80 px-3 backdrop-blur-md sm:px-6 lg:border-0 lg:bg-ground/70 lg:px-8">
          <Link href="/pipeline" aria-label="Service Pacts, Pipeline" className="flex min-h-11 items-center gap-2 lg:hidden">
            <ProductMark className="size-8 rounded-lg shadow-md shadow-action/20" />
            <span className="text-[17px] font-bold tracking-tight">{PRODUCT_NAME}</span>
          </Link>
          <button
            type="button"
            aria-label={collapsed ? "Show sidebar" : "Hide sidebar"}
            aria-expanded={!collapsed}
            aria-controls="app-sidebar"
            onClick={toggleSidebar}
            className="-ml-2 hidden size-9 shrink-0 items-center justify-center rounded-control text-ink-2 transition-colors duration-150 hover:bg-board hover:text-ink lg:inline-flex"
          >
            <PanelLeftIcon aria-hidden="true" className="size-[18px]" />
          </button>
          <form method="get" action="/search" role="search" className="relative hidden w-full max-w-md flex-1 lg:block">
            <SearchIcon aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-ink-2" />
            <input ref={topSearchRef} type="search" name="q" maxLength={SEARCH_MAX} aria-label="Search" aria-keyshortcuts="Control+K Meta+K" placeholder="Search customers, sites, agreements" className="h-10 w-full rounded-control border border-field bg-surface pr-12 pl-8 text-[13px] text-ink" />
            <kbd aria-hidden="true" className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 rounded-[4px] border border-hairline bg-ground px-1.5 text-[11px] text-ink-2">⌘K</kbd>
          </form>
          <div className="ml-auto flex items-center gap-1">
            {askAi}
            <Link href="/search" aria-label="Search" className="inline-flex size-11 items-center justify-center rounded-control text-ink hover:bg-board lg:hidden">
              <SearchIcon aria-hidden="true" className="size-[18px]" />
            </Link>
            <FollowUpBell count={followUps} />
            {newAgreement && <span className="hidden sm:block">{newAgreement}</span>}
            <span className="max-lg:hidden">
              <UserMenu email={email} role={role} orgName={orgName} canManageBilling={Boolean(plan?.canManage)} signOut={signOut} />
            </span>
            <MobileMenu>
              <div className="menu-pop absolute right-0 z-40 mt-2 flex max-h-[calc(100dvh-5rem)] w-72 flex-col overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden rounded-panel border border-hairline bg-surface p-2 shadow-float">
                <SidebarNav words={words} reports={reports} api={api} counts={counts} footer={<SidebarFooter plan={plan} email={email} role={role} signOut={signOut} full />} />
              </div>
            </MobileMenu>
          </div>
        </div>

        {frozen && (
          <div role="status" className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-hairline bg-board px-4 py-3 text-[13px] text-ink md:px-6 lg:px-8">
            <p className="font-medium">
              Your plan has ended, so this workspace is read-only. Everything is still here.
              {!frozen.canRenew && " Ask your owner to renew."}
            </p>
            {frozen.canRenew && (
              <Link href="/settings/billing" className="inline-flex min-h-11 items-center font-semibold text-action hover:underline lg:min-h-0">
                Renew subscription
              </Link>
            )}
          </div>
        )}
        <main className="flex flex-col gap-6 px-4 pt-5 pb-16 md:px-6 lg:px-8 lg:pt-3">{words ? <ItemWordsProvider words={words}>{children}</ItemWordsProvider> : children}</main>
      </div>
    </div>
  );
}
