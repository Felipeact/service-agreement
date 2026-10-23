"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FOOTER_NAV, MAIN_NAV, type NavItem } from "./nav-items";

export const ITEM_CLASSES = "flex h-11 items-center rounded-control px-2.5 font-medium lg:h-9";

function NavEntry({ item, pathname, onNavigate }: { item: NavItem; pathname: string; onNavigate?: () => void }) {
  if (!item.href) {
    return (
      <span role="link" aria-disabled="true" className={`${ITEM_CLASSES} cursor-not-allowed text-ink-2`}>
        {item.label}
      </span>
    );
  }
  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      onClick={onNavigate}
      className={`${ITEM_CLASSES} ${active ? "bg-action-tint text-action" : "text-ink-nav hover:bg-ground"}`}
    >
      {item.label}
    </Link>
  );
}

/** The main nav, and Settings pinned to the bottom above an optional footer. */
export function SidebarNav({ onNavigate, footer }: { onNavigate?: () => void; footer?: ReactNode }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="flex h-full flex-col gap-0.5">
      {MAIN_NAV.map((item) => (
        <NavEntry key={item.label} item={item} pathname={pathname} onNavigate={onNavigate} />
      ))}
      <div className="mt-auto flex flex-col gap-0.5 border-t border-hairline pt-3">
        {FOOTER_NAV.map((item) => (
          <NavEntry key={item.label} item={item} pathname={pathname} onNavigate={onNavigate} />
        ))}
        {footer}
      </div>
    </nav>
  );
}
