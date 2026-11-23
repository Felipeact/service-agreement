import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Fragment, Suspense } from "react";
import { PreviewBar } from "../../_components/preview-bar";
import { SCREENS } from "../../_components/registry";
import { ShellA } from "../../_components/shell-a";
import { ShellB } from "../../_components/shell-b";
import { ShellC } from "../../_components/shell-c";
import { VARIANTS, isVariant } from "../../_components/variants";

export const metadata: Metadata = { title: "Design preview", robots: { index: false } };

const SHELLS = { a: ShellA, b: ShellB, c: ShellC } as const;

export function generateStaticParams() {
  return VARIANTS.flatMap((variant) => SCREENS.map((screen) => ({ variant: variant.key, screen: screen.slug })));
}

/**
 * One private screen in one of three designs, on invented data: /concepts/app/<a|b|c>/<screen>. A preview for the owner to
 * compare and choose from; the real pages are rebuilt from the one chosen, and this folder is removed after.
 */
type ScreenProps = { params: Promise<{ variant: string; screen: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export default function ScreenPage(props: ScreenProps) {
  return (
    <Suspense fallback={<div aria-busy="true" className="min-h-dvh" />}>
      <Screen {...props} />
    </Suspense>
  );
}

async function Screen({ params, searchParams }: ScreenProps) {
  const { variant, screen: slug } = await params;
  const query = Object.fromEntries(Object.entries(await searchParams).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]));
  const screen = SCREENS.find((entry) => entry.slug === slug);
  if (!isVariant(variant) || !screen) notFound();
  const Shell = SHELLS[variant];
  return (
    <>
      <PreviewBar slug={slug} variant={variant} />
      <Fragment key={JSON.stringify(query)}>
        <Shell active={screen.nav}>{screen.render(query)}</Shell>
      </Fragment>
    </>
  );
}
