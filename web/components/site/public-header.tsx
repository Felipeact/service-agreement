import Link from "next/link";
import { ProductMark } from "@/components/ui/product-mark";

/** The public pages the header links to, in order. */
export const PUBLIC_NAV = [
  { href: "/product", label: "Product" },
  { href: "/demo", label: "Demo" },
  { href: "/trades", label: "Trades" },
  { href: "/pricing", label: "Pricing" },
] as const;

export type PublicPage = (typeof PUBLIC_NAV)[number]["href"];

/**
 * The one header every public page wears: the product mark and name (no country or currency badge), the four public pages,
 * Sign in and Get started. On a phone the pages sit behind a native `<details>` menu, so they are reachable without script.
 * `active` marks the page you are on.
 */
export function PublicHeader({ active }: { active?: PublicPage }) {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200/80 bg-white/85 backdrop-blur-md" data-purpose="main-header">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <Link href="/" aria-label="Service Pacts, home" className="flex min-h-11 items-center gap-2.5">
          <ProductMark className="size-8" />
          <span className="text-lg font-bold tracking-tight text-slate-900">Service Pacts</span>
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-8 md:flex">
          {PUBLIC_NAV.map((link) => {
            const isActive = link.href === active;
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={isActive ? "page" : undefined}
                className={`flex min-h-11 items-center gap-1.5 text-sm transition-colors ${isActive ? "font-semibold text-blue-600" : "font-medium text-slate-600 hover:text-slate-900"}`}
              >
                {link.label}
                {isActive && <span aria-hidden="true" className="size-1.5 rounded-full bg-blue-600" />}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-1 sm:gap-3">
          <Link href="/login" className="inline-flex min-h-11 items-center px-2 text-sm font-semibold text-slate-700 transition-colors hover:text-slate-900">
            Sign in
          </Link>
          <Link
            href="/register"
            className="hidden min-h-11 items-center gap-1.5 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-blue-700 sm:inline-flex"
          >
            <span>Get started</span>
            <span className="material-symbols-outlined text-base leading-none" aria-hidden="true">arrow_forward</span>
          </Link>

          <details className="group relative md:hidden">
            <summary
              aria-label="Menu"
              className="flex size-11 cursor-pointer list-none items-center justify-center rounded-xl text-slate-700 hover:bg-slate-100 marker:hidden [&::-webkit-details-marker]:hidden"
            >
              <svg aria-hidden="true" viewBox="0 0 20 20" className="size-5 fill-none stroke-current" strokeWidth="1.8" strokeLinecap="round">
                <path d="M3 6h14M3 10h14M3 14h14" className="group-open:hidden" />
                <path d="m5 5 10 10M15 5 5 15" className="hidden group-open:block" />
              </svg>
            </summary>
            <nav aria-label="Menu" className="absolute right-0 z-20 mt-2 flex w-60 flex-col rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
              {PUBLIC_NAV.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={link.href === active ? "page" : undefined}
                  className={`flex min-h-11 items-center rounded-xl px-3 text-sm hover:bg-slate-50 ${link.href === active ? "font-semibold text-blue-600" : "font-medium text-slate-700"}`}
                >
                  {link.label}
                </Link>
              ))}
              <Link href="/register" className="mt-1 flex min-h-11 items-center justify-center rounded-xl bg-blue-600 px-3 text-sm font-semibold text-white hover:bg-blue-700">
                Get started
              </Link>
            </nav>
          </details>
        </div>
      </div>
    </header>
  );
}
