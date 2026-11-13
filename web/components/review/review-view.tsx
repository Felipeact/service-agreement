import type { ReactNode } from "react";
import { TenantLogoImage } from "@/components/ui/tenant-logo";
import type { PortalView } from "@/application/ports";
import { portalLayout, portalScope, type PortalDecision } from "@/application/use-cases";
import { ServiceEquipmentSection, ServiceIncludedSection } from "@/components/agreements/service-scope";
import { VisitScheduleSection } from "@/components/agreements/visit-schedule";
import { buttonClass } from "@/components/ui/button";
import { NEUTRAL_ACCENT, termLine, termsOf, typeFrequencies, visitSchedule, type BlockItem, type IncludedOptions, type LayoutItem, type PriceOptions, type TitleOptions } from "@/domain/agreement";
import { formatTermDate } from "@/domain/agreement/term";
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
  /** The public address of the contractor's logo, `null` when it has none. */
  logoUrl?: string | null;
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

const INDENT_CLASS = ["", "ml-4", "ml-8", "ml-12"] as const;

/** The template's text blocks as plain paragraphs, headings in the section-heading size (level 1 larger): the same blocks the PDF draws. */
function TemplateText({ label, blocks }: { label: string; blocks: BlockItem[] }) {
  if (blocks.length === 0) return null;
  return (
    <section aria-label={label} className="flex flex-col gap-2">
      {blocks.map((block, index) => {
        const indent = INDENT_CLASS[block.indent ?? 0];
        return block.type === "heading" ? (
          <h2 key={index} className={`${block.level === 1 ? "text-[18px] font-bold" : "text-[15px] font-semibold"} break-words ${indent}`.trim()}>
            {block.text}
          </h2>
        ) : (
          <p key={index} className={`text-[14px] break-words whitespace-pre-line ${indent}`.trim()}>
            {block.text}
          </p>
        );
      })}
    </section>
  );
}

const DEFAULT_COLUMNS = { description: "Description", visits: "Visits per year", perVisit: "Per visit", perYear: "Per year", total: "Total per year" };

/** What the customer reads: the version's layout in its order (text, service lines, schedule, scope, terms). Every state with content shows this. */
function Content({ view }: { view: PortalView }) {
  const terms = view.terms ? termsOf(view.terms, view.term.months) : [];
  const scope = portalScope(view);
  const types = scope.source === "not_recorded" ? [] : scope.types;
  const { layout } = portalLayout(view);
  const lastSection = layout.reduce((last, item, index) => (item.kind === "section" ? index : last), -1);
  const firstSection = layout.findIndex((item) => item.kind === "section");
  const scopeProps = { scope, siteId: "", canAddEquipment: false, words: view.tenant?.words };

  const drawSection = (item: Extract<LayoutItem, { kind: "section" }>, key: number) => {
    switch (item.key) {
      case "price": {
        const options: PriceOptions = item.options ?? {};
        const columns = options.columns ?? DEFAULT_COLUMNS;
        const title = options.title ?? "Service lines";
        return (
          <section key={key} aria-label={title} className={panel}>
            <h2 className={heading}>{title}</h2>
            <div
              data-line-head
              className="hidden gap-x-3 border-b border-hairline px-4 py-2 text-[12px] font-medium text-ink-2 md:grid md:grid-cols-[minmax(0,3fr)_6rem_8rem_8rem]"
            >
              <span>{columns.description}</span>
              <span>{columns.visits}</span>
              <span className="text-right">{columns.perVisit}</span>
              <span className="text-right">{columns.perYear}</span>
            </div>
            <ul className="divide-y divide-hairline">
              {view.lines.map((line, index) => (
                <li key={index} className="grid gap-x-3 gap-y-0.5 px-4 py-3 text-[14px] md:grid-cols-[minmax(0,3fr)_6rem_8rem_8rem]">
                  <span className="font-medium break-words">{line.description}</span>
                  <span className="text-ink-2 md:text-ink">
                    {options.visitsFormat === "times_per_year"
                      ? `${line.visitsPerYear} ${line.visitsPerYear === 1 ? "time" : "times"} per year`
                      : `${line.visitsPerYear} ${line.visitsPerYear === 1 ? "visit" : "visits"} per year`}
                  </span>
                  <span className="text-ink-2 md:text-right md:text-ink">{`${formatCadExact(line.costPerVisitCents)} per visit`}</span>
                  <span className="font-medium md:text-right">{formatCadExact(line.annualCents)}</span>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-t border-hairline px-4 py-3">
              <p className="text-[15px] font-semibold">
                {columns.total} <span>{formatCadExact(view.annualCents)}</span>
              </p>
              <p className="text-[12px] text-ink-2">before tax</p>
            </div>
          </section>
        );
      }
      case "schedule": {
        const options: TitleOptions = item.options ?? {};
        return <VisitScheduleSection key={key} schedule={visitSchedule(view.lines, types)} title={options.title} />;
      }
      case "included": {
        const options: IncludedOptions = item.options ?? {};
        return (
          <ServiceIncludedSection
            key={key}
            {...scopeProps}
            title={options.title}
            showFrequency={options.showFrequency}
            uppercase={options.uppercase}
            frequencies={options.showFrequency ? typeFrequencies(view.lines, types) : undefined}
          />
        );
      }
      case "equipment": {
        const options: TitleOptions = item.options ?? {};
        return <ServiceEquipmentSection key={key} {...scopeProps} title={options.title} />;
      }
      case "terms":
        return (
          terms.length > 0 && (
            <section key={key} aria-label="Terms" className={panel}>
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
          )
        );
      default:
        return null;
    }
  };

  // Consecutive text blocks are one run: before the first section it is the introduction, after the last the closing text.
  const out: ReactNode[] = [];
  let run: BlockItem[] = [];
  let runStart = 0;
  const flush = () => {
    if (run.length === 0) return;
    const label = firstSection === -1 || runStart < firstSection ? "Introduction" : runStart > lastSection ? "Closing text" : "Text";
    out.push(<TemplateText key={`text-${runStart}`} label={label} blocks={run} />);
    run = [];
  };
  layout.forEach((item, index) => {
    if (item.kind === "block") {
      if (run.length === 0) runStart = index;
      run.push(item);
      return;
    }
    flush();
    out.push(drawSection(item, index));
  });
  flush();
  return <>{out}</>;
}

/**
 * The customer's page for one link, branded as the contractor and naming no one else (customer-portal AC 8 to 17).
 * A state with no content shows only its message.
 */
export function ReviewView({ token, view, state, actions, logoUrl = null }: ReviewViewProps) {
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
          {logoUrl && <TenantLogoImage src={logoUrl} name={tenantName} />}
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
            {/* A link always shows a frozen version (term-dates AC 18, 19). */}
            <p data-term className="text-[14px] text-ink-2">
              {termLine(view.term, false)}
            </p>
            {state === "open" && view.validUntil && (
              <p className="text-[14px] text-ink-2">Valid until {formatTermDate(view.validUntil)}</p>
            )}
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
