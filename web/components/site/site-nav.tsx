"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV } from "./content";

type Tone = "light" | "night" | "action";

const LINK_TONE: Record<Tone, string> = {
  light: "text-ink-2 hover:text-ink",
  night: "text-night-ink hover:text-surface",
  action: "text-surface/90 hover:text-surface",
};

const ACTIVE_TONE: Record<Tone, string> = { light: "text-ink", night: "text-surface", action: "text-surface" };

/** The header's main links with a dot under the page you are on (docs/DESIGN.md "Navigation Bar & Tabs"). Client only for `usePathname`. */
export function SiteNav({ tone }: { tone: Tone }) {
  const pathname = usePathname() ?? "";
  return (
    <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
      {NAV.map((link) => {
        const isActive = pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={isActive ? "page" : undefined}
            className={`relative inline-flex min-h-[34px] items-center gap-1.5 rounded-control px-3 text-[13px] font-medium transition-colors duration-150 ${isActive ? ACTIVE_TONE[tone] : LINK_TONE[tone]}`}
          >
            {link.label}
            {isActive && <span aria-hidden="true" className="size-1 rounded-full bg-action" />}
          </Link>
        );
      })}
    </nav>
  );
}
