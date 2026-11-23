import type { Metadata } from "next";
import { Suspense } from "react";
import { intervalFromParam } from "@/domain/billing";
import { Content } from "./_components/content";

export const metadata: Metadata = { title: "Pricing" };

/** Reads `?billing=annual` at request time; the monthly page is the prerendered fallback. */
export async function PricingForRequest({ searchParams }: Pick<PageProps<"/pricing">, "searchParams">) {
  const { billing } = await searchParams;
  return <Content interval={intervalFromParam(billing)} />;
}

/**
 * From the owner's mockup (docs/service_pacts_pricing). `?billing=annual` shows the yearly prices and carries the choice into
 * /register; the choice rides the URL so the page stays a Server Component. Without `searchParams` it is the monthly page.
 */
export default function PricingPage({ searchParams }: Partial<Pick<PageProps<"/pricing">, "searchParams">>) {
  if (!searchParams) return <Content />;
  return (
    <Suspense fallback={<Content />}>
      <PricingForRequest searchParams={searchParams} />
    </Suspense>
  );
}
