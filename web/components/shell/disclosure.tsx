"use client";

import { MenuIcon, XIcon } from "lucide-react";
import { useEffect, useRef, type MouseEvent, type ReactNode } from "react";

/** A native `<details>` that closes when a link inside it is tapped (a client-side navigation would leave it open), on Escape and on a tap outside. */
export function Disclosure({ summary, children, className = "", summaryClass = "" }: { summary: ReactNode; children: ReactNode; className?: string; summaryClass?: string }) {
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
    const target = event.target as HTMLElement;
    if (ref.current && (target.closest("a") || target.closest("button[type=submit]"))) ref.current.open = false;
  }
  return (
    <details ref={ref} onClick={handleClick} className={`group relative ${className}`}>
      <summary className={`flex cursor-pointer list-none marker:hidden [&::-webkit-details-marker]:hidden ${summaryClass}`}>{summary}</summary>
      {children}
    </details>
  );
}

/** The phone's menu button and its panel. */
export function MobileMenu({ children }: { children: ReactNode }) {
  return (
    <Disclosure
      className="lg:hidden"
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
