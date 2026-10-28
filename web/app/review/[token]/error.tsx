"use client";

import { Button } from "@/components/ui/button";

/** An unexpected read failure: no detail, no tenant, a way to retry (customer-portal Observable, error state). */
export default function ReviewError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col items-start justify-center gap-4 px-4 py-10">
      <p role="alert" className="text-[15px] font-medium">
        Something went wrong. Try again, or contact the company that sent this link.
      </p>
      <Button onClick={() => reset()}>Try again</Button>
    </main>
  );
}
