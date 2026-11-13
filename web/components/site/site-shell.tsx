import Link from "next/link";
import type { ReactNode } from "react";
import { LinkButton } from "@/components/ui/link-button";
import { ProductMark } from "@/components/ui/product-mark";
import { FOOTER_LINKS, NAV, SITE } from "./content";

type Tone = "light" | "night" | "action";

const HEADER_TONE: Record<Tone, string> = {
  light: "bg-ground text-ink",
  night: "bg-night text-surface",
  action: "bg-action text-surface",
};

const LINK_TONE: Record<Tone, string> = {
  light: "text-ink-nav hover:bg-board",
  night: "text-night-ink hover:bg-surface/10 hover:text-surface",
  action: "text-surface/90 hover:bg-surface/15 hover:text-surface",
};

const navLink = "inline-flex min-h-11 items-center rounded-control px-3 text-[13px] font-medium transition-colors duration-150 lg:min-h-[34px]";

/**
 * The public site's frame: a header that sits on the first section's own ground (`tone`), then the page, then the footer.
 * Static, so every marketing page prerenders. The mobile menu is a native `<details>`, which needs no script; Sign in
 * stays outside it so a returning member is never more than one tap away.
 */
export function SiteShell({ tone = "light", children }: { tone?: Tone; children: ReactNode }) {
  const onLight = tone === "light";
  return (
    <div className="min-h-dvh">
      <header className={HEADER_TONE[tone]}>
        <div className="mx-auto flex max-w-[1180px] items-center gap-2 px-4 py-3 md:px-6 lg:px-8">
          <Link href="/" className="mr-auto flex min-h-11 items-center gap-2.5 rounded-control pr-2" aria-label={`${SITE.name}, home`}>
            <ProductMark className="size-8" />
            <span className="font-display text-[16px] font-semibold tracking-tight">{SITE.name}</span>
          </Link>

          <nav aria-label="Main" className="hidden items-center gap-0.5 lg:flex">
            {NAV.map((link) => (
              <Link key={link.href} href={link.href} className={`${navLink} ${LINK_TONE[tone]}`}>
                {link.label}
              </Link>
            ))}
          </nav>

          <Link href="/login" className={`${navLink} ${LINK_TONE[tone]}`}>
            Sign in
          </Link>
          <LinkButton href="/register" variant="primary" className={`max-sm:hidden ${onLight ? "" : "bg-surface text-ink hover:bg-surface/90"}`}>
            Get started
          </LinkButton>

          <details className="group relative lg:hidden">
            <summary
              className={`flex size-11 cursor-pointer list-none items-center justify-center rounded-control marker:hidden [&::-webkit-details-marker]:hidden ${LINK_TONE[tone]}`}
              aria-label="Menu"
            >
              <svg aria-hidden="true" viewBox="0 0 20 20" className="size-5 fill-none stroke-current" strokeWidth="1.8" strokeLinecap="round">
                <path d="M3 6h14M3 10h14M3 14h14" className="group-open:hidden" />
                <path d="m5 5 10 10M15 5 5 15" className="hidden group-open:block" />
              </svg>
            </summary>
            <nav aria-label="Menu" className="absolute right-0 z-20 mt-2 flex w-60 flex-col rounded-panel border border-hairline bg-surface p-2 text-ink shadow-panel">
              {NAV.map((link) => (
                <Link key={link.href} href={link.href} className="flex min-h-11 items-center rounded-control px-3 text-[14px] font-medium hover:bg-ground">
                  {link.label}
                </Link>
              ))}
              <LinkButton href="/register" variant="primary" className="mt-1">
                Get started
              </LinkButton>
            </nav>
          </details>
        </div>
      </header>

      <main>{children}</main>

      <footer className="bg-night text-night-ink">
        <div className="mx-auto grid max-w-[1180px] gap-8 px-4 py-10 md:px-6 lg:grid-cols-[1.2fr_1fr_1fr] lg:px-8 lg:py-14">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2.5 text-surface">
              <ProductMark className="size-8" />
              <span className="font-display text-[16px] font-semibold tracking-tight">{SITE.name}</span>
            </div>
            <p className="max-w-[36ch]">{SITE.description}</p>
            <p className="text-[12px]">Built for Canada outside Quebec. Prices in Canadian dollars.</p>
          </div>
          <nav aria-label="Footer" className="grid grid-cols-2 content-start gap-x-6">
            {FOOTER_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className="flex min-h-11 items-center hover:text-surface lg:min-h-9">
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="flex flex-col gap-2">
            <p className="font-display text-[15px] font-semibold text-surface">Ready to try it?</p>
            <p>Monthly plans from $79. Cancel any time.</p>
            <LinkButton href="/register" variant="primary" className="self-start">
              Get started
            </LinkButton>
          </div>
        </div>
      </footer>
    </div>
  );
}
