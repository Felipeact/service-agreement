import type { Metadata } from "next";
import Link from "next/link";
import { ProductMark } from "@/components/ui/product-mark";
import { SCREENS } from "./_components/registry";
import { VARIANTS } from "./_components/variants";

export const metadata: Metadata = { title: "Design preview, three designs", robots: { index: false } };

/** The index of the design preview: three designs, each with every private screen, on one set of invented data. */
export default function PreviewIndex() {
  const groups = [...new Set(SCREENS.map((screen) => screen.group))];
  return (
    <div className="relative isolate min-h-dvh bg-linear-to-b from-[#f4f7ff] to-surface">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] overflow-hidden"><div className="absolute -top-40 left-[6%] size-[440px] rounded-full bg-action/10 blur-[100px]" /><div className="absolute -top-32 right-[8%] size-[400px] rounded-full bg-cyan-400/10 blur-[110px]" /></div>
      <main className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6">
        <header className="flex flex-col gap-3">
          <span className="flex items-center gap-2.5"><ProductMark className="size-9 rounded-xl shadow-md shadow-action/20" /><span className="text-[18px] font-bold tracking-tight">Service Pacts</span></span>
          <h1 className="text-[32px] leading-10 font-extrabold tracking-tight">Design B, every private screen</h1>
          <p className="max-w-2xl text-[15px] text-ink-nav">{SCREENS.length} private screens in the chosen design, on invented data. Filters, forms, dialogs, tabs and menus work; nothing is saved. Each screen has an Open the real page button, so you can set B beside the real page and mark what is off.</p>
        </header>

        <ul className="grid gap-4 md:grid-cols-3">
          {VARIANTS.map((variant) => (
            <li key={variant.key} className="flex flex-col gap-3 rounded-panel border border-hairline bg-surface p-5 shadow-card">
              <span className="flex size-10 items-center justify-center rounded-xl bg-action text-[16px] font-extrabold text-surface shadow-md shadow-action/25">{variant.key.toUpperCase()}</span>
              <h2 className="text-[18px] font-bold tracking-tight">{variant.name}</h2>
              <p className="text-[14px] text-ink-nav">{variant.idea}</p>
              <Link href={`/concepts/app/${variant.key}/pipeline`} className="mt-auto inline-flex h-11 items-center justify-center rounded-control bg-action px-5 text-[14px] font-semibold text-surface shadow-md shadow-action/20 hover:bg-action-hover">Open {variant.name}</Link>
            </li>
          ))}
        </ul>

        {groups.map((group) => (
          <section key={group} aria-labelledby={`g-${group}`} className="flex flex-col gap-3">
            <h2 id={`g-${group}`} className="text-[18px] font-bold tracking-tight">{group}</h2>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {SCREENS.filter((screen) => screen.group === group).map((screen) => (
                <li key={screen.slug} className="flex flex-col gap-2 rounded-panel border border-hairline bg-surface p-4 shadow-card">
                  <span className="text-[15px] font-semibold">{screen.title}</span>
                  <span className="text-[13px] text-ink-2">{screen.note}</span>
                  <span className="mt-1 flex flex-wrap gap-2">
                    {VARIANTS.map((variant) => (
                      <Link key={variant.key} href={`/concepts/app/${variant.key}/${screen.slug}`} aria-label={`${screen.title} in design ${variant.key.toUpperCase()}, ${variant.name}`} className="inline-flex size-11 items-center justify-center rounded-control border border-hairline text-[13px] font-bold text-ink-nav hover:border-action hover:bg-action-tint hover:text-action-press lg:size-9">
                        {variant.key.toUpperCase()}
                      </Link>
                    ))}
                    <Link href={screen.real} className="inline-flex h-11 items-center rounded-control border border-hairline px-3 text-[13px] font-semibold text-ink-nav hover:border-action hover:bg-action-tint hover:text-action-press lg:h-9">
                      Real page
                    </Link>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </main>
    </div>
  );
}
