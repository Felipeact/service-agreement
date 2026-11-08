"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Icon } from "@/components/ui/icons";
import { ProductMark } from "@/components/ui/product-mark";
import { SearchInput } from "@/components/ui/search-input";
import { SEARCH_MAX } from "@/domain/records";
import { SidebarAccount } from "./sidebar-account";
import type { ItemWords } from "@/domain/org-settings";
import { ItemWordsProvider } from "./item-words";
import { SidebarNav } from "./sidebar-nav";

const PRODUCT_NAME = "Service Agreement";
const SEARCH_SHORTCUT = "/";

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
          className="absolute -top-0.5 -right-0.5 inline-flex min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] leading-4 font-semibold text-surface lg:top-0 lg:right-0"
        >
          {count > 9 ? "9+" : count}
        </span>
      )}
    </Link>
  );
}

/** The product name over the tenant's company name, beside the mark. Both sit on the Night shell. */
function Brand({ orgName, markClass }: { orgName: string; markClass: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <ProductMark className={markClass} />
      <div className="min-w-0">
        <div className="font-display text-[16px] leading-tight font-semibold tracking-tight text-surface">{PRODUCT_NAME}</div>
        <div className="pt-0.5 text-[12px] leading-snug font-medium break-words text-night-ink">{orgName}</div>
      </div>
    </div>
  );
}

/** Fixed Night sidebar on desktop (the app's one search lives in it); a Night top bar with a navigation drawer below 1024px. */
export function AppShell({ children, orgName, email, signOut, followUps = 0, todayLabel, words }: AppShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

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
      if (!searchRef.current || searchRef.current.offsetParent === null) return;
      event.preventDefault();
      searchRef.current.focus();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-dvh flex-col bg-night px-3 pt-5 pb-4 lg:flex">
        <div className="px-2.5 pb-6">
          <Brand orgName={orgName} markClass="size-8" />
        </div>
        <form method="get" action="/search" role="search" className="px-0.5 pb-3">
          <SearchInput
            ref={searchRef}
            label="Search"
            name="q"
            placeholder="Search"
            maxLength={SEARCH_MAX}
            tone="night"
            shortcut={SEARCH_SHORTCUT}
          />
        </form>
        <SidebarNav words={words} footer={<SidebarAccount email={email} signOut={signOut} />} />
      </aside>

      <div className="sticky top-0 z-10 flex h-14 items-center gap-2 bg-night px-2 lg:hidden">
        <button
          ref={menuButtonRef}
          type="button"
          aria-label="Open navigation"
          aria-expanded={drawerOpen}
          onClick={() => setDrawerOpen(true)}
          className="inline-flex size-11 items-center justify-center rounded-control text-surface transition-colors duration-150 hover:bg-surface/10"
        >
          <Icon name="menu" />
        </button>
        <ProductMark className="size-6" />
        <span className="font-display text-[16px] font-semibold tracking-tight text-surface">{PRODUCT_NAME}</span>
        <Link
          href="/pipeline?followups=1"
          aria-label={followUps > 0 ? `${followUps} need follow-up` : "Follow-ups: none due"}
          className="relative ml-auto inline-flex size-11 items-center justify-center rounded-control text-surface transition-colors duration-150 hover:bg-surface/10"
        >
          <Icon name="bell" className="size-[18px]" />
          {followUps > 0 && <span aria-hidden="true" className="absolute top-2 right-2 size-2 rounded-full bg-danger" />}
        </Link>
        <Link
          href="/search"
          aria-label="Search"
          className="inline-flex size-11 items-center justify-center rounded-control text-surface transition-colors duration-150 hover:bg-surface/10"
        >
          <Icon name="search" className="size-[18px]" />
        </Link>
      </div>

      {drawerOpen && (
        <div className="fixed inset-0 z-20 lg:hidden">
          <div data-backdrop className="absolute inset-0 bg-ink/50" onClick={closeDrawer} />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            className="absolute inset-y-0 left-0 flex w-[272px] flex-col bg-night px-3 pt-2 pb-4 shadow-panel"
          >
            <div className="flex items-center justify-between pb-3 pl-2.5">
              <Brand orgName={orgName} markClass="size-8" />
              <button
                ref={closeButtonRef}
                type="button"
                aria-label="Close navigation"
                onClick={closeDrawer}
                className="inline-flex size-11 shrink-0 items-center justify-center rounded-control text-night-ink transition-colors duration-150 hover:bg-surface/10 hover:text-surface"
              >
                <Icon name="close" />
              </button>
            </div>
            <SidebarNav words={words} onNavigate={closeDrawer} footer={<SidebarAccount email={email} signOut={signOut} />} />
          </div>
        </div>
      )}

      <div className="min-w-0 lg:col-start-2 lg:row-start-1">
        <header className="sticky top-0 z-10 hidden h-14 items-center gap-3 border-b border-hairline bg-ground/90 px-8 backdrop-blur lg:flex">
          {todayLabel && <span className="text-[13px] text-ink-2">{todayLabel}</span>}
          <div className="ml-auto flex items-center gap-4">
            <FollowUpBell count={followUps} />
            <div className="flex flex-col items-end leading-tight">
              <span className="text-[13px] font-semibold text-ink">{orgName}</span>
              <span className="text-[12px] text-ink-2">Workspace</span>
            </div>
          </div>
        </header>
        <main className="px-4 py-6 md:px-6 lg:px-8 lg:py-7">{words ? <ItemWordsProvider words={words}>{children}</ItemWordsProvider> : children}</main>
      </div>
    </div>
  );
}
