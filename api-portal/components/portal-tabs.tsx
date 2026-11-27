"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PORTAL_TABS, activeTab } from "@/lib/developer";

/** The portal's tabs as links, so each is a page of its own. They scroll sideways on a narrow screen instead of wrapping. */
export function PortalTabs() {
  const active = activeTab(usePathname() ?? "/");
  return (
    <nav aria-label="API and MCP" className="-mx-4 flex gap-1 overflow-x-auto border-b border-hairline px-4 [scrollbar-width:none] md:mx-0 md:px-0 [&::-webkit-scrollbar]:hidden">
      {PORTAL_TABS.map((tab) => {
        const isActive = tab.href === active;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={isActive ? "page" : undefined}
            className={`-mb-px inline-flex min-h-11 shrink-0 items-center border-b-2 px-3 text-[14px] font-medium whitespace-nowrap transition-colors ${isActive ? "border-action text-action-press" : "border-transparent text-ink-nav hover:text-ink"}`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
