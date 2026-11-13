import Link from "next/link";
import type { PlanLimitNotice } from "@/domain/billing/plan-limits";

/** The refusal a plan limit gives, with a link to change plan for an owner or admin (plan-limits AC 5, 6, 15). */
export function PlanLimitAlert({ message, billingHref }: PlanLimitNotice) {
  return (
    <p role="alert" className="text-[13px] font-medium text-danger">
      {message}
      {billingHref && (
        <>
          {" "}
          <Link href={billingHref} className="inline-flex min-h-11 items-center text-action lg:min-h-0">
            Change plan
          </Link>
        </>
      )}
    </p>
  );
}
