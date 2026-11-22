"use client";

import { SparklesIcon } from "lucide-react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Icon } from "@/components/ui/icons";
import { ProductMark } from "@/components/ui/product-mark";
import { SearchInput } from "@/components/ui/search-input";
import { SEARCH_MAX } from "@/domain/records";
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
  /** Today's date as the business reads it ("Friday, November 6"), formatted on the server so the page and the browser agree. */
  todayLabel?: string;
  /** The org's item words, for the Sites link; the default when absent. */
  words?: ItemWords;
  /** The company's plan has ended: a banner says the workspace is read-only. `canRenew` is true for an owner or admin, who gets the link to Billing. */
  frozen?: { canRenew: boolean };
  /** The member may read Reports (owner, admin or estimator): the sidebar shows the link. */
  reports?: boolean;
  /** The member's role, shown under their email and in the top bar. */
  role?: string;
  /** The plan and how much of its live-agreement limit is used; absent when the org has no plan or the figure could not be read. */
  plan?: PlanQuotaFigure | null;
  /** A count per nav item `href`, shown as a small badge (open agreements beside Pipeline). */
  counts?: Record<string, number>;
};

/** The bell: a link to the Pipeline filtered to the agreements that need follow-up, with their count when there are any. */
function FollowUpBell({ count }: { count: number }) {
  return (
    <Link
      href="/pipeline?followups=1"
      aria-label={count > 0 ? `${count} ${count === 1 ? "agreement needs" : "agreements need"} follow-up` : "Follow-ups: none due"}
      className="relative inline-flex size-11 items-center justify-center rounded-control text-ink-2 transition-colors duration-150 hover:bg-board hover:text-ink lg:size-9"
    >
      <Icon name="bell" />
      {count > 0 && (
        <span
          aria-hidden="true"
          className="badge-pop absolute -top-0.5 -right-0.5 inline-flex min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] leading-4 font-semibold text-surface lg:top-0 lg:right-0"
        >
          {count > 9 ? "9+" : count}
        </span>
      )}
    </Link>
  );
}

/** The plan's quota card (when there is a plan to show) above the signed-in member's account row. */
function SidebarFooter({ plan, email, role, signOut }: { plan?: PlanQuotaFigure | null; email: string; role?: string; signOut: () => Promise<void> }) {
  return (
    <div className="flex flex-col gap-2 pt-2">
      {plan && <PlanQuota {...plan} />}
      <SidebarAccount email={email} role={role} signOut={signOut} />
    </div>
  );
}

/** A white sidebar floating on the pale ground on desktop (the app's one search lives in it); a frosted top bar with a navigation drawer below 1024px. */
export function AppShell({ children, orgName, email, signOut, followUps = 0, todayLabel, words, frozen, reports, role, plan, counts }: AppShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const topSearchRef = useRef<HTMLInputElement>(null);
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

  function closeDrawer() {
    setDrawerOpen(false);
    menuButtonRef.current?.focus();
  }

  useEffect(() => {
    if (!drawerOpen) return;
    closeButtonRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setDrawerOpen(false);
        menuButtonRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [drawerOpen]);

  // "/" jumps to the search from anywhere, unless the visitor is already typing somewhere.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== SEARCH_SHORTCUT || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
      if (!searchRef.current || searchRef.current.offsetParent === null || collapsed) return;
      event.preventDefault();
      searchRef.current.focus();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [collapsed]);

  // Ctrl or Cmd + K jumps to the top bar's search and Ctrl or Cmd + B hides or shows the sidebar, as the mockup's hints say.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey) return;
      const key = event.key.toLowerCase();
      if (key === "k") {
        const field = [topSearchRef.current, searchRef.current].find((node) => node && node.offsetParent !== null);
        if (!field) return;
        event.preventDefault();
        field.focus();
        field.select();
      } else if (key === "b" && window.matchMedia("(min-width: 1024px)").matches) {
        event.preventDefault();
        toggleSidebar();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  });

  return (
    <div
      className={`min-h-dvh lg:grid lg:transition-[grid-template-columns] lg:duration-300 lg:ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none ${
        collapsed ? "lg:grid-cols-[0px_minmax(0,1fr)]" : "lg:grid-cols-[280px_minmax(0,1fr)]"
      }`}
    >
      <aside id="app-sidebar" inert={collapsed} className="sticky top-0 z-20 hidden h-dvh min-w-0 overflow-hidden lg:block">
        {/* Fixed width inside the shrinking column, so the content slides and fades rather than reflowing. */}
        <div
          className={`relative h-full w-[280px] p-3 transition-[opacity,translate] ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-opacity ${
            collapsed ? "-translate-x-6 opacity-0 duration-150" : "translate-x-0 opacity-100 duration-300"
          }`}
        >
          <div className="flex h-full flex-col overflow-hidden rounded-panel border border-hairline bg-surface px-3 pt-4 pb-3 shadow-card">
          <div className="flex items-center justify-between px-2.5 pb-2.5">
            <span className="text-[12px] font-semibold text-ink-2">Navigation</span>
            <button
              type="button"
              aria-label="Hide sidebar"
              aria-expanded={!collapsed}
              aria-controls="app-sidebar"
              onClick={toggleSidebar}
              className="inline-flex size-7 items-center justify-center rounded-control text-ink-2 transition-colors duration-150 hover:bg-board hover:text-ink"
            >
              <Icon name="sidebar" className="size-4" />
            </button>
          </div>
          <div className="pb-3">
            <WorkspaceCard orgName={orgName} planName={plan?.planName} />
          </div>
          <form method="get" action="/search" role="search" className="px-0.5 pb-3">
            <SearchInput
              ref={searchRef}
              label="Search"
              name="q"
              placeholder="Search"
              maxLength={SEARCH_MAX}
              shortcut={SEARCH_SHORTCUT}
            />
          </form>
          <SidebarNav words={words} reports={reports} counts={counts} footer={<SidebarFooter plan={plan} email={email} role={role} signOut={signOut} />} />
          </div>
        </div>
      </aside>

      <div className="sticky top-0 z-10 flex h-14 items-center gap-2 border-b border-hairline bg-surface/80 px-2 backdrop-blur-md lg:hidden">
        <button
          ref={menuButtonRef}
          type="button"
          aria-label="Open navigation"
          aria-expanded={drawerOpen}
          onClick={() => setDrawerOpen(true)}
          className="inline-flex size-11 items-center justify-center rounded-control text-ink transition-colors duration-150 hover:bg-board"
        >
          <Icon name="menu" />
        </button>
        <ProductMark className="size-7 rounded-lg shadow-md shadow-action/20" />
        <span className="font-display text-[17px] font-bold tracking-tight text-ink">{PRODUCT_NAME}</span>
        <Link
          href="/pipeline?followups=1"
          aria-label={followUps > 0 ? `${followUps} need follow-up` : "Follow-ups: none due"}
          className="relative ml-auto inline-flex size-11 items-center justify-center rounded-control text-ink transition-colors duration-150 hover:bg-board"
        >
          <Icon name="bell" className="size-[18px]" />
          {followUps > 0 && <span aria-hidden="true" className="badge-pop absolute top-2 right-2 size-2 rounded-full bg-danger" />}
        </Link>
        <Link
          href="/search"
          aria-label="Search"
          className="inline-flex size-11 items-center justify-center rounded-control text-ink transition-colors duration-150 hover:bg-board"
        >
          <Icon name="search" className="size-[18px]" />
        </Link>
      </div>

      <AnimatePresence>
        {drawerOpen && (
          <motion.div
            key="drawer"
            className="fixed inset-0 z-20 lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.2 } }}
            exit={{ opacity: 0, transition: { duration: 0.15 } }}
          >
            <div data-backdrop className="absolute inset-0 bg-ink/50" onClick={closeDrawer} />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Navigation"
              className="absolute inset-y-0 left-0 flex w-[288px] flex-col overflow-y-auto bg-surface px-3 pt-2 pb-4 shadow-panel"
              initial={{ x: -288 }}
              animate={{ x: 0, transition: { duration: 0.32, ease: [0.16, 1, 0.3, 1] } }}
              exit={{ x: -288, transition: { duration: 0.18, ease: [0.4, 0, 1, 1] } }}
            >
              <div className="flex items-center justify-between gap-2 pb-3">
                <div className="min-w-0 flex-1">
                  <WorkspaceCard orgName={orgName} planName={plan?.planName} />
                </div>
                <button
                  ref={closeButtonRef}
                  type="button"
                  aria-label="Close navigation"
                  onClick={closeDrawer}
                  className="inline-flex size-11 shrink-0 items-center justify-center rounded-control text-ink-2 transition-colors duration-150 hover:bg-board hover:text-ink"
                >
                  <Icon name="close" />
                </button>
              </div>
              <SidebarNav words={words} reports={reports} counts={counts} onNavigate={closeDrawer} footer={<SidebarFooter plan={plan} email={email} role={role} signOut={signOut} />} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative isolate min-w-0 lg:col-start-2 lg:row-start-1">
        {/* The public hero's soft blue and cyan wash and faint grid, behind the top of every page. */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] overflow-hidden">
          <div className="absolute -top-40 left-[6%] size-[440px] rounded-full bg-action/10 blur-[100px]" />
          <div className="absolute -top-32 right-[8%] size-[400px] rounded-full bg-cyan-400/10 blur-[110px]" />
          <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(15,23,42,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(15,23,42,0.03)_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:radial-gradient(ellipse_80%_80%_at_50%_0%,#000_35%,transparent_100%)]" />
        </div>
        <header className="sticky top-0 z-10 hidden h-16 items-center gap-3 bg-ground/70 px-8 backdrop-blur-md lg:flex">
          <button
            type="button"
            aria-label={collapsed ? "Show sidebar" : "Hide sidebar"}
            aria-expanded={!collapsed}
            aria-controls="app-sidebar"
            onClick={toggleSidebar}
            className="-ml-2 inline-flex size-9 shrink-0 items-center justify-center rounded-control text-ink-2 transition-colors duration-150 hover:bg-board hover:text-ink"
          >
            <Icon name="sidebar" />
          </button>
          <form method="get" action="/search" role="search" className="w-full max-w-xl flex-1">
            <SearchInput ref={topSearchRef} label="Search" name="q" placeholder="Search contacts, deals, or tasks..." maxLength={SEARCH_MAX} shortcut="⌘K" />
          </form>
          <div className="ml-auto flex items-center gap-3">
            {todayLabel && <span className="hidden text-[12px] text-ink-2 2xl:inline">{todayLabel}</span>}
            <button
              type="button"
              disabled
              title="Coming soon"
              className="inline-flex h-[34px] items-center gap-1.5 rounded-full border border-violet-200 bg-violet-50 px-3.5 text-[12px] font-semibold text-violet-700 disabled:cursor-not-allowed"
            >
              <SparklesIcon aria-hidden="true" className="size-3.5" />
              Ask AI
            </button>
            <FollowUpBell count={followUps} />
            <UserMenu email={email} role={role} orgName={orgName} canManageBilling={Boolean(plan?.canManage)} signOut={signOut} />
          </div>
        </header>
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
        <main className="px-4 py-6 md:px-6 lg:px-8 lg:pt-3 lg:pb-10">{words ? <ItemWordsProvider words={words}>{children}</ItemWordsProvider> : children}</main>
      </div>
    </div>
  );
}
