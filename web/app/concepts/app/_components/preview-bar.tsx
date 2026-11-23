import Link from "next/link";
import { SCREENS } from "./registry";
import { VARIANTS, type Variant } from "./variants";

/** The strip above a preview: switch design without losing the screen, step to the neighbouring screens, back to the index. Not part of any design. */
export function PreviewBar({ slug, variant }: { slug: string; variant: Variant }) {
  const index = SCREENS.findIndex((screen) => screen.slug === slug);
  const prev = SCREENS[index - 1];
  const next = SCREENS[index + 1];
  const chip = "inline-flex min-h-11 shrink-0 items-center rounded-md px-3 text-[13px] font-medium hover:bg-surface/10 hover:text-surface lg:min-h-9";
  return (
    <nav aria-label="Design preview" className="relative z-50 flex items-center gap-1 overflow-x-auto bg-ink px-3 text-night-ink lg:px-6">
      <Link href="/concepts/app" className={`${chip} font-semibold text-surface`}>All</Link>
      <span aria-hidden="true" className="mx-1 h-5 w-px shrink-0 bg-night-line" />
      {VARIANTS.map((entry) => (
        <span key={entry.key} className="shrink-0 px-2 text-[13px] font-semibold text-surface">
          Design {entry.key.toUpperCase()}, {entry.name}
        </span>
      ))}
      <Link href={SCREENS[index]?.real ?? "/pipeline"} className={`${chip} bg-action text-surface hover:bg-action-hover`}>
        Open the real page
      </Link>
      <span aria-hidden="true" className="mx-1 h-5 w-px shrink-0 bg-night-line" />
      <span className="shrink-0 px-2 text-[13px]">{SCREENS[index]?.title} <span className="text-night-ink/70">({index + 1} of {SCREENS.length})</span></span>
      <span className="ml-auto flex shrink-0">
        {prev && <Link href={`/concepts/app/${variant}/${prev.slug}`} className={chip}>← {prev.title}</Link>}
        {next && <Link href={`/concepts/app/${variant}/${next.slug}`} className={chip}>{next.title} →</Link>}
      </span>
    </nav>
  );
}
