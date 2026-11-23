import Link from "next/link";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/shell/page-header";
import type { BillingLoad } from "@/application/use-cases";
import { canChangeBilling, isEnded, cardLine, dateLine, formatDay, invoiceRows, statusLabel, type BillingOverview } from "@/domain/billing/overview";
import { PLANS } from "@/domain/billing";
import { formatResetDate, formatTokens, isFull, remaining, type OrgUsage, type UsageFigure } from "@/domain/billing/plan-limits";
import { Button } from "@/components/ui/button";
import { SectionPanel } from "@/components/ui/section-panel";
import { CardUpdate } from "./card-update";
import { PlanSwitcher } from "./plan-switcher";
import { SubscriptionControls } from "./subscription-controls";
import type { BillingActions } from "./state";

export { CancelPrompt, CardFormShell, CardUpdateButton } from "./billing-parts";

/** What the page shows once the member is allowed in (a `forbidden` member never reaches the view). */
export type BillingPageState = Exclude<BillingLoad, { kind: "forbidden" }>;

type Props = {
  state: BillingPageState;
  /** Live agreements and AI imports against the plan; `null` is a failed read, absent shows no section (plan-limits S3). */
  usage?: OrgUsage | null;
  /** The publishable key, or `null` when card updates are not set up. */
  publishableKey: string | null;
  /** The Server Actions; absent in tests that only render markup. */
  actions?: BillingActions;
};

function Invoices({ invoices }: { invoices: BillingOverview["invoices"] }) {
  if (invoices === "unavailable") return <p className="px-5 py-6 text-[13px] text-ink-2">We couldn&apos;t load your invoices</p>;
  const rows = invoiceRows(invoices);
  if (rows.length === 0) return <p className="px-5 py-6 text-[13px] text-ink-2">No invoices yet</p>;
  return (
    <>
      <div aria-hidden="true" className="hidden grid-cols-[minmax(0,1.5fr)_1fr_1fr_5rem] gap-4 border-b border-hairline bg-ground/70 px-5 py-2.5 text-[12px] font-semibold text-ink-2 md:grid">
        <span>Invoice</span>
        <span>Amount</span>
        <span>Status</span>
        <span />
      </div>
      <ul className="divide-y divide-hairline">
        {rows.map((row) => (
          <li key={row.id} className="grid grid-cols-2 items-center gap-x-4 gap-y-1 px-5 py-3 text-[14px] md:grid-cols-[minmax(0,1.5fr)_1fr_1fr_5rem]">
            <span className="min-w-0">
              <span className="block font-medium text-ink">{row.number}</span>
              <span className="block text-[12px] text-ink-2">{row.day}</span>
            </span>
            <span className="font-semibold md:font-normal">{row.amount}</span>
            <span>
              <span className="inline-flex h-[22px] items-center rounded-full bg-pill-completed px-2.5 text-[11px] font-semibold text-pill-completed-ink capitalize">{row.status}</span>
            </span>
            {row.url ? (
              <a href={row.url} target="_blank" rel="noopener noreferrer" className="inline-flex h-11 min-w-11 items-center justify-center rounded-control text-[13px] font-semibold text-action hover:bg-board lg:h-9">
                View
              </a>
            ) : (
              <span />
            )}
          </li>
        ))}
      </ul>
    </>
  );
}

function UsageRow({ label, figure }: { label: string; figure: UsageFigure }) {
  const share = figure.limit ? Math.min(100, Math.round((figure.used / figure.limit) * 100)) : 0;
  return (
    <div className="flex flex-col gap-1.5 text-[13px]">
      <div className="flex flex-wrap items-center justify-between gap-x-4">
        <dt className="font-medium">{label}</dt>
        <dd className="flex items-center gap-2 font-semibold">
          {figure.limit === null ? `${figure.used}` : `${figure.used} of ${figure.limit}`}
          {remaining(figure) !== null && !isFull(figure) && <span className="font-normal text-ink-2">{`${remaining(figure)} left`}</span>}
          {isFull(figure) && <span className="rounded-control bg-board px-2 py-0.5 text-[12px] font-semibold text-danger">Full</span>}
        </dd>
      </div>
      {figure.limit !== null && (
        <div role="progressbar" aria-label={`${label} used`} aria-valuemin={0} aria-valuemax={figure.limit} aria-valuenow={figure.used} className="h-2 overflow-hidden rounded-full bg-board">
          <div className={`h-full rounded-full ${isFull(figure) ? "bg-danger" : "bg-action"}`} style={{ width: `${share}%` }} />
        </div>
      )}
    </div>
  );
}

/** Live agreements and this month's AI imports against the plan (plan-limits S3); `null` is a failed read. */
function Usage({ usage }: { usage: OrgUsage | null }) {
  return (
    <SectionPanel id="billing-usage" title="Usage" className="h-full">
      {usage === null ? (
        <p className="text-[13px] text-ink-2">Usage unavailable</p>
      ) : (
        <div className="flex flex-col gap-4">
          <dl className="flex flex-col gap-4">
            <UsageRow label="Live agreements" figure={usage.liveAgreements} />
            <UsageRow label="AI imports this month" figure={usage.aiImports} />
            {usage.aiTokens && (
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-[13px]">
                <dt className="font-medium">AI reading used this month</dt>
                <dd className="font-semibold">{formatTokens(usage.aiTokens)}</dd>
              </div>
            )}
          </dl>
          <p className="text-[12px] text-ink-2">{`The AI import count resets on ${formatResetDate(usage.resetsOn)}.`}</p>
        </div>
      )}
    </SectionPanel>
  );
}

function Ready({ plan, overview, usage, publishableKey, actions }: { plan: string; overview: BillingOverview; usage?: OrgUsage | null; publishableKey: string | null; actions?: BillingActions }) {
  const line = dateLine(overview);
  const mayChange = canChangeBilling(overview.status);
  const ending = overview.endsAt !== null;
  const endDate = formatDay(overview.endsAt ?? overview.periodEnd ?? overview.trialEnd ?? 0);
  return (
    <>
      <SectionPanel id="billing-plan" title="Plan" note={[statusLabel(overview.status), line].filter(Boolean).join(" · ")}>
        <div className="flex flex-col gap-4">
          <span className="sr-only">{plan}</span>
          {isEnded(overview.status) && actions?.renew && (
            <form action={actions.renew} className="flex flex-col gap-2 rounded-control border border-hairline bg-ground p-4">
              <p className="text-[13px] font-medium text-ink">Your plan has ended, so the workspace is read-only. Renew to start editing and sending again. Nothing is deleted.</p>
              <div>
                <Button type="submit" variant="primary">
                  Renew subscription
                </Button>
              </div>
            </form>
          )}
          {mayChange && (
            <PlanSwitcher
              current={overview.plan}
              seats={(PLANS.find((candidate) => candidate.key === overview.plan)?.includedSeats ?? 0) + overview.extraSeats}
              trialEndsOn={overview.status === "trialing" && overview.trialEnd !== null ? formatDay(overview.trialEnd) : null}
              readOnlyReason={ending ? "Resume your subscription to change plan" : overview.plan === null ? "This plan can't be changed here" : null}
              actions={actions}
            />
          )}
        </div>
      </SectionPanel>
      <div className="grid gap-6 lg:grid-cols-2">
        {usage !== undefined && <Usage usage={usage} />}
        <SectionPanel id="billing-card" title="Payment method" className="h-full">
          <div className="flex flex-col gap-3">
            <p className="text-[14px] font-semibold">{cardLine(overview.card)}</p>
            {mayChange && <CardUpdate publishableKey={publishableKey} actions={actions} />}
          </div>
        </SectionPanel>
      </div>
      <SectionPanel id="billing-invoices" title="Invoices" flush>
        <Invoices invoices={overview.invoices} />
      </SectionPanel>
      {mayChange && (
        <div className="flex justify-end">
          <SubscriptionControls ending={ending} endDate={endDate} actions={actions} />
        </div>
      )}
    </>
  );
}

/** The in-app billing page body (billing-page S1 to S3): plan, card and invoices for an owner or admin. */
export function BillingView({ state, usage, publishableKey, actions }: Props) {
  return (
    <div className="flex w-full max-w-5xl flex-col gap-6">
      <Link href="/settings" className="inline-flex min-h-11 w-fit items-center gap-1 text-[13px] font-semibold text-action hover:underline lg:min-h-8">
        ← Settings
      </Link>
      <PageHeader title="Billing" subtitle="Your plan, your card and your invoices." />
      {state.kind === "ready" && <Ready plan={state.plan} overview={state.overview} usage={usage} publishableKey={publishableKey} actions={actions} />}
      {state.kind === "no_subscription" && <p className="rounded-control bg-board px-4 py-3 text-[13px] text-ink-2">This workspace has no subscription</p>}
      {state.kind === "not_configured" && <p className="rounded-control bg-board px-4 py-3 text-[13px] text-ink-2">Billing isn&apos;t available yet</p>}
      {state.kind === "error" && (
        <div className="flex flex-col items-start gap-2">
          <p role="alert" className="text-[13px] font-medium text-danger">
            We couldn&apos;t load billing. Try again.
          </p>
          <Link href="/settings/billing" className="inline-flex h-11 items-center rounded-control border border-hairline bg-surface px-4 text-[13px] font-semibold text-ink hover:bg-ground lg:h-[34px]">
            Try again
          </Link>
        </div>
      )}
    </div>
  );
}
