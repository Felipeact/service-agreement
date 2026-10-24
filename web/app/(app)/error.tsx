"use client";

import { Button } from "@/components/ui/button";
import { EmptyPanel } from "@/components/ui/empty-panel";

/** An unexpected read error. Next logs the error and its digest on the server. */
export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <EmptyPanel title="Something went wrong" text="The page could not be loaded.">
      <Button onClick={() => reset()}>Try again</Button>
    </EmptyPanel>
  );
}
