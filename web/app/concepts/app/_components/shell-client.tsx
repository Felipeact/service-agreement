"use client";

import Link from "next/link";
import { useEffect, useRef, type MouseEvent, type ReactNode } from "react";
import { ChevronDownIcon, CreditCardIcon, LogOutIcon, MenuIcon, SettingsIcon, UsersIcon, XIcon } from "lucide-react";
import { COMPANY } from "./data";

const screenHref = (slug: string) => `./${slug}`;

/** A native `<details>` that closes when a link inside it is tapped (a client-side navigation would leave it open) and on Escape. */
function Disclosure({ summary, children, className = "", summaryClass = "" }: { summary: ReactNode; children: ReactNode; className?: string; summaryClass?: string }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && ref.current?.open) {
        ref.current.open = false;
        ref.current.querySelector("summary")?.focus();
      }
    }
    function handleOutside(event: Event) {
      if (ref.current?.open && !ref.current.contains(event.target as Node)) ref.current.open = false;
    }
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerdown", handleOutside);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", handleOutside);
    };
  }, []);
  function handleClick(event: MouseEvent<HTMLDetailsElement>) {
    if (ref.current && (event.target as HTMLElement).closest("a")) ref.current.open = false;
  }
  return (
    <details ref={ref} onClick={handleClick} className={`group relative ${className}`}>
      <summary className={`flex cursor-pointer list-none marker:hidden [&::-webkit-details-marker]:hidden ${summaryClass}`}>{summary}</summary>
      {children}
    </details>
  );
}

/** The phone's menu button and its panel. */
export function MobileMenu({ children, hideFrom = "lg" }: { children: ReactNode; hideFrom?: "lg" | "xl" }) {
  return (
    <Disclosure
      className={hideFrom === "xl" ? "xl:hidden" : "lg:hidden"}
      summaryClass="size-11 items-center justify-center rounded-control text-ink hover:bg-board"
      summary={
        <>
          <MenuIcon aria-hidden="true" className="size-5 group-open:hidden" />
          <XIcon aria-hidden="true" className="hidden size-5 group-open:block" />
          <span className="sr-only">Menu</span>
        </>
      }
    >
      {children}
    </Disclosure>
  );
}

/** The signed-in member's chip with the menu its arrow promises. */
export function UserMenu() {
  return (
    <Disclosure
      className="max-lg:hidden"
      summaryClass="items-center gap-2.5 rounded-control border-l border-hairline py-1 pr-1 pl-3 hover:bg-board"
      summary={
        <>
          <span aria-hidden="true" className="inline-flex size-8 items-center justify-center rounded-full bg-linear-to-br from-action to-cyan-500 text-[12px] font-bold text-surface shadow-card">{COMPANY.initials}</span>
          <span className="flex flex-col text-left leading-tight">
            <span className="text-[12px] font-semibold">Dana</span>
            <span className="text-[11px] text-ink-2">{COMPANY.role}</span>
          </span>
          <ChevronDownIcon aria-hidden="true" className="size-4 text-ink-2" />
          <span className="sr-only">Account menu</span>
        </>
      }
    >
      <div className="menu-pop absolute right-0 z-40 mt-2 w-60 rounded-panel border border-hairline bg-surface p-1 shadow-float">
        <div className="px-2 py-2">
          <p className="truncate text-[13px] font-semibold">{COMPANY.email}</p>
          <p className="text-[12px] text-ink-2">{COMPANY.role} · {COMPANY.name}</p>
        </div>
        <div className="my-1 h-px bg-hairline" />
        {[
          { label: "Settings", slug: "settings", icon: SettingsIcon },
          { label: "Members", slug: "members", icon: UsersIcon },
          { label: "Billing", slug: "billing", icon: CreditCardIcon },
          { label: "Sign out", slug: "../../../login", icon: LogOutIcon },
        ].map((item) => (
          <Link key={item.slug} href={screenHref(item.slug)} className="flex min-h-9 items-center gap-2 rounded-control px-2 text-[13px] hover:bg-board">
            <item.icon aria-hidden="true" className="size-4 text-ink-2" />
            {item.label}
          </Link>
        ))}
      </div>
    </Disclosure>
  );
}
