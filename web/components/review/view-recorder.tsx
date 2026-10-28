"use client";

import { useEffect, useRef } from "react";

/**
 * Records the first view from the browser, once. A mail scanner or prefetcher that only fetches the address never
 * runs this, so it cannot fake a view (customer-portal assumption "Recording a view").
 */
export function ViewRecorder({ record }: { record: () => Promise<unknown> }) {
  const recorded = useRef(false);
  useEffect(() => {
    if (recorded.current) return;
    recorded.current = true;
    record().catch(() => {
      // The customer is reading; a missed view is not theirs to fix.
    });
  }, [record]);
  return <span hidden data-view-recorder="" />;
}
