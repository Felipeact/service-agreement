import { redirect } from "next/navigation";
import { Suspense } from "react";

/** A design's front door: it opens on the Pipeline. */
export default function VariantIndex({ params }: { params: Promise<{ variant: string }> }) {
  return (
    <Suspense fallback={null}>
      <Open params={params} />
    </Suspense>
  );
}

async function Open({ params }: { params: Promise<{ variant: string }> }): Promise<null> {
  const { variant } = await params;
  redirect(`/concepts/app/${variant}/pipeline`);
}
