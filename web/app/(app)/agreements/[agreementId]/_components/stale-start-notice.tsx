import { TriangleAlertIcon } from "lucide-react";
import { STALE_START_DAYS, formatTermDate, isStaleStart, isTermStart } from "@/domain/agreement/term";

/**
 * A warning, not a block, under a start date field: a start date more than `STALE_START_DAYS` days in the past is almost always
 * a slip (2019 for 2029) and it prints on the agreement. The send prompt asks again before sending.
 */
export function StaleStartNotice({ start }: { start: string }) {
  if (!isTermStart(start) || !isStaleStart(start, new Date())) return null;
  return (
    <p role="status" data-testid="stale-start-notice" className="flex items-start gap-1.5 text-[12px] font-medium text-amber-700">
      <TriangleAlertIcon aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
      <span>{`${formatTermDate(start)} is more than ${STALE_START_DAYS} days in the past. It prints on the agreement, so check the year.`}</span>
    </p>
  );
}
