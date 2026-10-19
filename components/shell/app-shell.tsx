"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { SidebarNav } from "./sidebar-nav";

const PRODUCT_NAME = "Service Agreement";

/** Fixed sidebar on desktop; a top bar with a navigation drawer below 1024px. */
export function AppShell({ children }: { children: ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

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

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[232px_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-hairline bg-surface px-3 pt-[18px] pb-4 lg:flex">
        <div className="px-2.5 pb-5 text-[15px] font-bold">{PRODUCT_NAME}</div>
        <SidebarNav />
      </aside>

      <div className="sticky top-0 z-10 flex h-14 items-center gap-2 border-b border-hairline bg-surface px-2 lg:hidden">
        <button
          ref={menuButtonRef}
          type="button"
          aria-label="Open navigation"
          aria-expanded={drawerOpen}
          onClick={() => setDrawerOpen(true)}
          className="inline-flex size-11 items-center justify-center rounded-control text-ink hover:bg-ground"
        >
          <svg aria-hidden="true" viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <path d="M3 5.5h14M3 10h14M3 14.5h14" />
          </svg>
        </button>
        <span className="text-[15px] font-bold">{PRODUCT_NAME}</span>
      </div>

      {drawerOpen && (
        <div className="fixed inset-0 z-20 lg:hidden">
          <div data-backdrop className="absolute inset-0 bg-ink/40" onClick={closeDrawer} />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            className="absolute inset-y-0 left-0 flex w-[264px] flex-col bg-surface px-3 pt-2 pb-4 shadow-card"
          >
            <div className="flex items-center justify-between pb-3 pl-2.5">
              <span className="text-[15px] font-bold">{PRODUCT_NAME}</span>
              <button
                ref={closeButtonRef}
                type="button"
                aria-label="Close navigation"
                onClick={closeDrawer}
                className="inline-flex size-11 items-center justify-center rounded-control text-ink-2 hover:bg-ground"
              >
                <svg aria-hidden="true" viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                  <path d="m5 5 10 10M15 5 5 15" />
                </svg>
              </button>
            </div>
            <SidebarNav onNavigate={closeDrawer} />
          </div>
        </div>
      )}

      <main className="min-w-0 px-4 py-5 md:px-5 lg:px-7">{children}</main>
    </div>
  );
}
