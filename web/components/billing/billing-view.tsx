import Link from "next/link";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/shell/page-header";
import type { BillingLoad } from "@/application/use-cases";
import { canChangeBilling, cardLine, dateLine, formatDay, invoiceRows, statusLabel, type BillingOverview } from "@/domain/billing/overview";
import { CardUpdate } from "./card-update";
import { SubscriptionControls } from "./subscription-controls";
import type { BillingActions } from "./state";

export { CancelPrompt, CardFormShell, CardUpdateButton } from "./billing-parts";

/** What the page shows once the member is allowed in (a `forbidden` member never reaches the view). */
export type BillingPageState = Exclude<BillingLoad, { kind: "forbidden" }>;

type Props = {
  state: BillingPageState;
  /** The publishable key, or `null` when card updates are not set up. */
  publishableKey: string | null;
  /** The Server Actions; absent in tests that only render markup. */
  actions?: BillingActions;
};

const CARD = "flex flex-col gap-4 rounded-panel border border-hairline bg-surface p-5 shadow-card sm:p-6";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={CARD}>
      <h2 className="font-display text-[18px] font-semibold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}

function Invoices({ invoices }: { invoices: BillingOverview["invoices"] }) {
  if (invoices === "unavailable") return <p className="text-[13px] text-ink-2">We couldn&apos;t load your invoices</p>;
  const rows = invoiceRows(invoices);
  if (rows.length === 0) return <p className="text-[13px] text-ink-2">No invoices yet</p>;
  return (
    <ul className="flex flex-col divide-y divide-hairline">
      {rows.map((row) => (
        <li key={row.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3 first:pt-0 last:pb-0">
          <span className="min-w-0 flex-1 basis-40 text-[13px] font-medium text-ink">
            {row.number}
            <span className="block text-[12px] font-normal text-ink-2">{row.day}</span>
          </span>
          <span className="text-[13px] text-ink">{row.amount}</span>
          <span className="text-[12px] text-ink-2 capitalize">{row.status}</span>
          {row.url && (
            <a href={row.url} target="_blank" rel="noopener noreferrer" className="inline-flex h-11 min-w-11 items-center justify-center text-[13px] font-semibold text-action hover:underline lg:h-auto lg:min-w-0">
              View
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}

function Ready({ plan, overview, publishableKey, actions }: { plan: string; overview: BillingOverview; publishableKey: string | null; actions?: BillingActions }) {
  const line = dateLine(overview);
  const mayChange = canChangeBilling(overview.status);
  const ending = overview.endsAt !== null;
  const endDate = formatDay(overview.endsAt ?? overview.periodEnd ?? overview.trialEnd ?? 0);
  return (
    <>
      <Section title="Plan">
        <div className="flex flex-col gap-1">
          <p className="flex flex-wrap items-center gap-2 text-[15px] font-semibold text-ink">
            {plan}
            <span className="rounded-control bg-board px-2 py-0.5 text-[12px] font-medium text-ink-2">{statusLabel(overview.status)}</span>
          </p>
          {line && <p className="text-[13px] text-ink-2">{line}</p>}
        </div>
        {mayChange && <SubscriptionControls ending={ending} endDate={endDate} actions={actions} />}
      </Section>
      <Section title="Payment method">
        <p className="text-[13px] text-ink">{cardLine(overview.card)}</p>
        {mayChange && <CardUpdate publishableKey={publishableKey} actions={actions} />}
      </Section>
      <Section title="Invoices">
        <Invoices invoices={overview.invoices} />
      </Section>
    </>
  );
}

/** The in-app billing page body (billing-page S1 to S3): plan, card and invoices for an owner or admin. */
export function BillingView({ state, publishableKey, actions }: Props) {
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <PageHeader title="Billing" subtitle="Your plan, your card and your invoices." />
      <Link href="/settings" className="inline-flex h-11 w-fit items-center text-[13px] font-semibold text-action hover:underline lg:h-auto">
        ← Settings
      </Link>
      {state.kind === "ready" && <Ready plan={state.plan} overview={state.overview} publishableKey={publishableKey} actions={actions} />}
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
