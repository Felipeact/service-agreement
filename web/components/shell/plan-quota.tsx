import Link from "next/link";
import { Progress } from "@/components/ui/progress";
import { BILLING_HREF, isFull } from "@/domain/billing/plan-limits";

export type PlanQuotaFigure = {
  /** The plan's display name ("Pro"). */
  planName: string;
  /** Agreements made the company holds. */
  used: number;
  /** What the plan allows. */
  limit: number;
  /** Owners and admins can change the plan, so only they get the Manage link. */
  canManage: boolean;
};

/**
 * "Agreements made 4 / 50" with a bar, above the account row in the sidebar (docs/DESIGN.md "App Shell").
 * The one saturated block in the sidebar. The bar turns amber at 80% and red once the limit is reached. Colour never carries the meaning alone: the count is text.
 */
export function PlanQuota({ planName, used, limit, canManage }: PlanQuotaFigure) {
  const share = limit > 0 ? Math.min(1, used / limit) : 0;
  const full = isFull({ used, limit });
  const barColour = full ? "bg-red-300" : share >= 0.8 ? "bg-amber-300" : "bg-surface";
  return (
    <div className="rounded-xl bg-linear-to-br from-action to-action-press p-3 text-surface shadow-md shadow-action/25" data-slot="plan-quota">
      <div className="flex items-baseline justify-between gap-2 text-[12px]">
        <span className="font-medium text-blue-100">Agreements made</span>
        <span className="font-semibold text-surface">
          {used} / {limit}
        </span>
      </div>
      <Progress
        value={Math.round(share * 100)}
        aria-label="Agreements made used"
        className="mt-2 h-1.5 bg-surface/25"
        indicatorClassName={barColour}
      />
      <p className="mt-1.5 text-[11px] leading-snug text-blue-100">Made in total, signed or not.</p>
      <div className="mt-2 flex items-center justify-between text-[12px] text-blue-100">
        <span>{planName} plan</span>
        {canManage && (
          <Link href={BILLING_HREF} className="inline-flex min-h-11 min-w-11 items-center justify-center font-semibold text-surface underline-offset-2 hover:underline lg:min-h-0">
            Manage
          </Link>
        )}
      </div>
    </div>
  );
}
