import type { ReactNode } from "react";
import type { PortalView } from "@/application/ports";
import { portalScope, type PortalDecision } from "@/application/use-cases";
import { ServiceScopeSections } from "@/components/agreements/service-scope";
import { buttonClass } from "@/components/ui/button";
import { NEUTRAL_ACCENT, termsOf } from "@/domain/agreement";
import { contrastText, isAccent, type PortalState } from "@/domain/portal";
import { formatCadExact } from "@/lib/money";
import { DecisionControls } from "./decision-controls";
import type { DecideState } from "./state";
import { ViewRecorder } from "./view-recorder";

export type ReviewActions = {
  decide: (decision: PortalDecision, reason: string) => Promise<DecideState>;
  record: () => Promise<unknown>;
};

type ReviewViewProps = {
  token: string;
  view: PortalView;
  /** Anything but `unknown`: an unknown link is the not-found page, not this view. */
  state: Exclude<PortalState, "unknown">;
  actions: ReviewActions;
};

const date = new Intl.DateTimeFormat("en-CA", { dateStyle: "medium", timeZone: "America/Vancouver" });

const panel = "overflow-hidden rounded-panel border border-hairline bg-surface";
const heading = "border-b border-hairline bg-ground px-4 py-2 text-[13px] font-semibold";

const DECIDED = {
  accepted: "You accepted this agreement",
  refused: "You refused this agreement",
  changes_requested: "You asked for changes",
} as const;

function Message({ children, tone = "plain" }: { children: ReactNode; tone?: "plain" | "notice" }) {
  const colours = tone === "notice" ? "border-transparent bg-attention-bg text-attention-fg" : "border-hairline bg-surface text-ink";
  return (
    <div role="status" className={`flex flex-col gap-1 rounded-panel border px-4 py-3 text-[14px] font-medium ${colours}`}>
      {children}
    </div>
  );
}

function Phone({ phone }: { phone: string | null }) {
  if (!phone) return null;
  return (
    <p className="text-[14px] font-normal">
      {"Phone "}
      <a href={`tel:${phone}`} className="inline-flex min-h-11 items-center font-semibold underline lg:min-h-0">
        {phone}
      </a>
    </p>
  );
}

/** What the customer reads: the version's lines, scope and frozen terms. Every state with content shows this. */
function Content({ view }: { view: PortalView }) {
  const terms = view.terms ? termsOf(view.terms) : [];
  return (
    <>
      <section aria-label="Service lines" className={panel}>
        <h2 className={heading}>Service lines</h2>
        <div
          data-line-head
          className="hidden gap-x-3 border-b border-hairline px-4 py-2 text-[12px] font-medium text-ink-2 md:grid md:grid-cols-[minmax(0,3fr)_6rem_8rem_8rem]"
        >
          <span>Description</span>
          <span>Visits per year</span>
          <span className="text-right">Per visit</span>
          <span className="text-right">Per year</span>
        </div>
        <ul className="divide-y divide-hairline">
          {view.lines.map((line, index) => (
            <li key={index} className="grid gap-x-3 gap-y-0.5 px-4 py-3 text-[14px] md:grid-cols-[minmax(0,3fr)_6rem_8rem_8rem]">
              <span className="font-medium break-words">{line.description}</span>
              <span className="text-ink-2 md:text-ink">{`${line.visitsPerYear} ${line.visitsPerYear === 1 ? "visit" : "visits"} per year`}</span>
              <span className="text-ink-2 md:text-right md:text-ink">{`${formatCadExact(line.costPerVisitCents)} per visit`}</span>
              <span className="font-medium md:text-right">{formatCadExact(line.annualCents)}</span>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-t border-hairline px-4 py-3">
          <p className="text-[15px] font-semibold">
            Total per year <span>{formatCadExact(view.annualCents)}</span>
          </p>
          <p className="text-[12px] text-ink-2">before tax</p>
        </div>
      </section>

      <ServiceScopeSections scope={portalScope(view)} siteId="" canAddEquipment={false} />

      {terms.length > 0 && (
        <section aria-label="Terms" className={panel}>
          <h2 className={heading}>Terms</h2>
          <dl className="divide-y divide-hairline">
            {terms.map((term) => (
              <div key={term.label} className="flex flex-wrap justify-between gap-x-4 gap-y-0.5 px-4 py-2.5 text-[14px]">
                <dt className="text-ink-2">{term.label}</dt>
                <dd className="font-medium">{term.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
    </>
  );
}

/**
 * The customer's page for one link, branded as the contractor and naming no one else (customer-portal AC 8 to 17).
 * A state with no content shows only its message.
 */
export function ReviewView({ token, view, state, actions }: ReviewViewProps) {
  const tenantName = view.tenant?.name ?? "the company";
  const accent = view.tenant?.accent && isAccent(view.tenant.accent) ? view.tenant.accent : NEUTRAL_ACCENT;
  const primary = { backgroundColor: accent, color: contrastText(accent) };
  const phone = view.tenant?.phone ?? null;
  const decision = view.decision;
  const showsContent = state === "open" || state === "decided" || state === "superseded";

  let message: ReactNode = null;
  if (state === "replaced") {
    message = (
      <Message>
        <p>{`This link has been replaced. Ask ${tenantName} for the new one.`}</p>
        <Phone phone={phone} />
      </Message>
    );
  } else if (state === "withdrawn" || state === "expired") {
    message = (
      <Message>
        <p>{state === "withdrawn" ? `${tenantName} withdrawn this agreement.` : "This agreement has expired."}</p>
        <Phone phone={phone} />
      </Message>
    );
  } else if (state === "superseded") {
    message = <Message tone="notice">{`A newer version of this agreement was sent. Ask ${tenantName} for its link.`}</Message>;
  } else if (state === "decided" && decision) {
    message = (
      <Message>
        <p>{`${DECIDED[decision.status]} on ${date.format(decision.decidedAt)}.`}</p>
        {decision.reason && <p className="font-normal break-words whitespace-pre-line">{`Your reason: ${decision.reason}`}</p>}
      </Message>
    );
  }

  return (
    <div className="min-h-dvh bg-ground">
      <header className="border-b border-hairline bg-surface">
        <div className="mx-auto flex max-w-[760px] flex-col gap-0.5 px-4 py-4">
          <p className="text-[18px] font-bold break-words">{tenantName}</p>
          {view.tenant?.address && <p className="text-[13px] text-ink-2">{view.tenant.address}</p>}
          {view.tenant?.phone && <p className="text-[13px] text-ink-2">{view.tenant.phone}</p>}
        </div>
      </header>
      <main className="mx-auto flex max-w-[760px] flex-col gap-4 px-4 py-6">
        {showsContent ? (
          <div className="flex flex-col gap-2">
            <h1 className="text-[22px] leading-tight font-bold">{`Agreement ${view.agreement.number}`}</h1>
            <div data-accent-rule="" style={{ backgroundColor: accent }} className="h-1 w-16 rounded-full" />
            <p className="text-[14px] text-ink-2">{`Version ${view.link.versionNo} · ${view.customer.name} · ${view.site.name}`}</p>
          </div>
        ) : (
          <h1 className="sr-only">Agreement</h1>
        )}
        {message}
        {showsContent && <Content view={view} />}
        {state === "open" && (
          <section aria-label="Your answer" className={`${panel} flex flex-col gap-3 px-4 py-4`}>
            <h2 className="text-[15px] font-semibold">Your answer</h2>
            <DecisionControls tenantName={tenantName} primary={primary} decide={actions.decide} />
          </section>
        )}
        {showsContent && (
          <div>
            <a href={`/review/${token}/pdf`} className={buttonClass("secondary", "w-full sm:w-auto")}>
              Download PDF
            </a>
          </div>
        )}
        {showsContent && <ViewRecorder record={actions.record} />}
      </main>
    </div>
  );
}
