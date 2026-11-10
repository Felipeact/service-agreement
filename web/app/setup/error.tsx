"use client";

import { Button } from "@/components/ui/button";
import { EmptyPanel } from "@/components/ui/empty-panel";

/** An unexpected read error: a read stamps nothing, so the owner can retry. */
export default function SetupError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-12 sm:px-6">
      <EmptyPanel title="Something went wrong" text="Your setup details could not be loaded.">
        <Button onClick={() => reset()}>Try again</Button>
      </EmptyPanel>
    </main>
  );
}
