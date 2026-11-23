import { Suspense } from "react";
import { intervalFromParam } from "@/domain/billing";
import { Content } from "./_components/home-content";

/** Reads `?billing=annual` at request time (the pricing section's switch); the monthly page is the prerendered fallback. */
export async function HomeForRequest({ searchParams }: Pick<PageProps<"/">, "searchParams">) {
  const { billing } = await searchParams;
  return <Content interval={intervalFromParam(billing)} />;
}

/** The public front door (`/`), from the owner's mockup (docs/service_pacts_home_light_redesign). Without `searchParams` it is the monthly page. */
export default function HomePage({ searchParams }: Partial<Pick<PageProps<"/">, "searchParams">>) {
  if (!searchParams) return <Content />;
  return (
    <Suspense fallback={<Content />}>
      <HomeForRequest searchParams={searchParams} />
    </Suspense>
  );
}
