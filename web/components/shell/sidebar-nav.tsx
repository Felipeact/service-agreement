"use client";

import { motion } from "motion/react";
import { useId, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/icons";
import { DEFAULT_ITEM_WORDS, type ItemWords } from "@/domain/org-settings";
import { mainNav, type NavItem } from "./nav-items";

export const ITEM_CLASSES = "flex h-11 shrink-0 items-center gap-3 rounded-xl px-3 font-medium transition-colors duration-150 lg:h-10";

/** The small count at an item's right edge, e.g. open agreements beside Pipeline. Its number is also in the link's accessible name. */
function CountBadge({ count, active }: { count: number; active: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] leading-none font-semibold ${active ? "bg-blue-100 text-action-press" : "bg-board text-ink-2"}`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

function NavEntry({ item, pathname, onNavigate, pillId, count }: { item: NavItem; pathname: string; onNavigate?: () => void; pillId: string; count?: number }) {
  if (!item.href) {
    return (
      <span role="link" aria-disabled="true" className={`${ITEM_CLASSES} cursor-not-allowed text-ink-2/60`}>
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
      aria-label={count === undefined ? undefined : `${item.label}, ${count}`}
      onClick={onNavigate}
      className={`${ITEM_CLASSES} relative isolate ${active ? "font-semibold text-action-press" : "text-ink-nav hover:bg-board hover:text-ink"}`}
    >
      {/* One pale-blue pill that glides to whichever item is current, so the shell shows where you went. */}
      {active && <motion.span aria-hidden="true" layoutId={pillId} transition={{ type: "spring", stiffness: 500, damping: 40 }} className="absolute inset-0 -z-10 rounded-xl bg-action-tint ring-1 ring-blue-100" />}
      <Icon name={item.icon} className={`size-[18px] ${active ? "text-action" : ""}`} />
      {item.label}
      {count !== undefined && <CountBadge count={count} active={active} />}
    </Link>
  );
}

/** The main nav, and Settings and Members pinned to the bottom above an optional footer. It sits on the white floating sidebar. */
export function SidebarNav({
  onNavigate,
  footer,
  words = DEFAULT_ITEM_WORDS,
  reports = false,
  counts = {},
}: {
  onNavigate?: () => void;
  footer?: ReactNode;
  words?: ItemWords;
  reports?: boolean;
  /** A count per item `href` (e.g. `{ "/pipeline": 4 }`); items without one show none. */
  counts?: Record<string, number>;
}) {
  const pathname = usePathname();
  const pillId = `nav-pill-${useId()}`;
  return (
    <nav aria-label="Main" className="flex min-h-0 flex-1 flex-col gap-0.5">
      <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {mainNav(words, reports).map((item) => (
        <NavEntry key={item.label} item={item} pathname={pathname} onNavigate={onNavigate} pillId={pillId} count={item.href ? counts[item.href] : undefined} />
      ))}
      </div>
      <div className="flex shrink-0 flex-col">
        {footer}
      </div>
    </nav>
  );
}
