"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/icons";
import { FOOTER_NAV, MAIN_NAV, type NavItem } from "./nav-items";

export const ITEM_CLASSES = "flex h-11 items-center gap-3 rounded-control px-2.5 font-medium transition-colors duration-150 lg:h-9";

function NavEntry({ item, pathname, onNavigate }: { item: NavItem; pathname: string; onNavigate?: () => void }) {
  if (!item.href) {
    return (
      <span role="link" aria-disabled="true" className={`${ITEM_CLASSES} cursor-not-allowed text-night-ink/60`}>
        <Icon name={item.icon} className="size-[18px]" />
        {item.label}
      </span>
    );
  }
  const path = pathname.split("?")[0];
  const active = path === item.href || path.startsWith(`${item.href}/`);
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      onClick={onNavigate}
      className={`${ITEM_CLASSES} ${active ? "bg-action text-surface" : "text-night-ink hover:bg-surface/10 hover:text-surface"}`}
    >
      <Icon name={item.icon} className="size-[18px]" />
      {item.label}
    </Link>
  );
}

/** The main nav, and Settings and Members pinned to the bottom above an optional footer. It sits on the Night shell. */
export function SidebarNav({ onNavigate, footer }: { onNavigate?: () => void; footer?: ReactNode }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="flex h-full flex-col gap-0.5">
      {MAIN_NAV.map((item) => (
        <NavEntry key={item.label} item={item} pathname={pathname} onNavigate={onNavigate} />
      ))}
      <div className="mt-auto flex flex-col gap-0.5 border-t border-surface/10 pt-3">
        {FOOTER_NAV.map((item) => (
          <NavEntry key={item.label} item={item} pathname={pathname} onNavigate={onNavigate} />
        ))}
        {footer}
      </div>
    </nav>
  );
}
