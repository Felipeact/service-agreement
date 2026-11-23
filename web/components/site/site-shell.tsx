import Link from "next/link";
import type { ReactNode } from "react";
import { LinkButton } from "@/components/ui/link-button";
import { ProductMark } from "@/components/ui/product-mark";
import { ArrowRightIcon } from "lucide-react";
import { FOOTER_LINKS, SITE } from "./content";
import { MockupFooter, MockupHeader } from "./mockup-chrome";
import { SiteNav } from "./site-nav";

type Tone = "light" | "night" | "action";

const HEADER_TONE: Record<Tone, string> = {
  light: "border-b border-hairline bg-surface/90 text-ink backdrop-blur",
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
      {onLight ? (
        <MockupHeader />
      ) : (
      <header className={`sticky top-0 z-30 ${HEADER_TONE[tone]}`}>
        <div className="mx-auto flex max-w-[1180px] items-center gap-2 px-4 py-3 md:px-6 lg:px-8">
          <Link href="/" className="mr-auto flex min-h-11 items-center gap-2.5 rounded-control pr-2" aria-label={`${SITE.name}, home`}>
            <ProductMark className="size-8" />
            <span className="text-[16px] font-semibold tracking-tight">{SITE.name}</span>
            <span title="Prices in Canadian dollars" className={`rounded-full border px-1.5 text-[10px] leading-4 font-semibold ${onLight ? "border-hairline bg-board text-ink-2" : "border-surface/30 text-night-ink"}`}>CAD</span>
          </Link>

          <SiteNav tone={tone} />

          <Link href="/login" className={`${navLink} ${LINK_TONE[tone]}`}>
            Sign in
          </Link>
          <LinkButton href="/register" variant="primary" className={`max-sm:hidden ${onLight ? "" : "bg-surface text-ink hover:bg-surface/90"}`}>
            Get started
            <ArrowRightIcon data-icon="inline-end" />
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
            <nav aria-label="Menu" className="menu-pop absolute right-0 z-20 mt-2 flex w-60 flex-col rounded-panel border border-hairline bg-surface p-2 text-ink shadow-panel">
              {FOOTER_LINKS.map((link) => (
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
      )}

      <main>{children}</main>

      <MockupFooter />
    </div>
  );
}
