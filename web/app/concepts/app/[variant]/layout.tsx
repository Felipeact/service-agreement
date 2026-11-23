import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { VARIANTS, isVariant } from "../_components/variants";
import "../looks.css";

export function generateStaticParams() {
  return VARIANTS.map((variant) => ({ variant: variant.key }));
}

/** Marks the page with the design it is showing, so the look hooks in looks.css take effect. */
export default function VariantLayout({ children, params }: { children: ReactNode; params: Promise<{ variant: string }> }) {
  return (
    <Suspense fallback={<div aria-busy="true" className="min-h-dvh" />}>
      <Looked params={params}>{children}</Looked>
    </Suspense>
  );
}

async function Looked({ children, params }: { children: ReactNode; params: Promise<{ variant: string }> }) {
  const { variant } = await params;
  if (!isVariant(variant)) notFound();
  return <div data-look={variant}>{children}</div>;
}
