import Link from "next/link";
import type { ReactNode } from "react";
import type { AgreementDetail, LinkEmailView, MemberRole } from "@/application/ports";
import { canWriteRecords } from "@/components/records/state";
import { PageHeader } from "@/components/shell/page-header";
import { Icon } from "@/components/ui/icons";
import { StatusPill } from "@/components/ui/status-pill";
import { labelFor, visitSchedule } from "@/domain/agreement";
import { CONTRACT_STATUS_META } from "@/domain/contract";
import { formatTermDate } from "@/domain/agreement/term";
import { notEmailedWords } from "@/domain/notifications";
import { DEFAULT_ITEM_WORDS, itemText, type ItemWords } from "@/domain/org-settings";
import { formatCadExact } from "@/lib/money";
import { GenerateContractControl } from "./contract-controls";
import { LineFormControl } from "./line-form";
import { LineRow } from "./line-row";
import { ReviseControl, WithdrawControl } from "./move-controls";
import { RecommendPanel, ReviewBar } from "./recommend-panel";
import { ScopeControls } from "./scope-controls";
import { TemplatePicker, type TemplateChoice } from "./template-picker";
import { ServiceScopeSections } from "./service-scope";
import { AgreementPdfPreview } from "./agreement-pdf-preview";
import { LinkControls } from "./link-controls";
import { NoteSection } from "./note-section";
import { TermSection } from "./term-section";
import { VersionCompare } from "./version-compare";
import { ActivitySection } from "./activity-section";
import { VersionsSection, hasVersionStory } from "./versions-section";
import { VisitCalendar } from "./visit-calendar";
import type { GenerateContractState } from "./contract-state";
import type { KeepState, LineState, LinkState, MoveState, NoteState, RecommendState, ScopeState, TemplateState, TermState } from "./state";

/** The page's Server Actions, bound to this agreement (or, for line writes, to one line). */
export type AgreementActions = {
  add: (formData: FormData) => Promise<LineState>;
  update: (lineId: string) => (formData: FormData) => Promise<LineState>;
  remove: (lineId: string) => () => Promise<LineState>;
  revise: () => Promise<MoveState>;
  withdraw: () => Promise<MoveState>;
  send: (email?: string, confirmUncovered?: boolean) => Promise<LinkState>;
  /** Leaves an asset out of the draft's scope, or puts it back (p0-launch-fixes). Optional so older fixtures compile. */
  setExcluded?: (assetId: string, excluded: boolean) => Promise<ScopeState>;
  /** Switches the draft to another template (agreement-template-switch). Optional so older fixtures compile. */
  setTemplate?: (templateVersionId: string) => Promise<TemplateState>;
  /** No longer offered on the page (the customer gets the link by email); kept so older callers still type-check. */
  reissue?: () => Promise<LinkState>;
  saveTerm: (formData: FormData) => Promise<TermState>;
  saveNote: (formData: FormData) => Promise<NoteState>;
  /** Optional so a page without contracts (and older fixtures) still compiles; the agreement page always binds it. */
  generate?: () => Promise<GenerateContractState>;
  /** Adds recommended lines for the site's uncovered equipment (recommended-lines). Optional so older fixtures compile. */
  recommend?: () => Promise<RecommendState>;
  /** Keeps one recommended line as it is, or all of them. */
  keep?: (lineId: string) => () => Promise<KeepState>;
  keepAll?: () => Promise<KeepState>;
};

type AgreementViewProps = {
  agreement: AgreementDetail;
  role: MemberRole;
  /** Without actions, or for a viewer, the agreement is read-only. */
  actions?: AgreementActions;
  /** The org's item words (item-vocabulary AC 5); the default when absent. */
  words?: ItemWords;
  /** The pinned template's preset equipment codes that match no type of the org, which the preset left off its lines (agreement-templates AC 25). */
  skippedCodes?: string[];
  /** The customer contact email the agreement is sent to, or `null` when there is none yet. */
  recipient?: string | null;
  /** The templates a writer can switch a draft to, the pinned one included; absent for a version that cannot change its template. */
  templateChoices?: { choices: TemplateChoice[]; selected: string };
};

/** A short fingerprint of what the PDF would say, so an open preview knows when to redraw. */
function revisionOf(value: unknown): string {
  let hash = 5381;
  for (const char of JSON.stringify(value)) hash = ((hash * 33) ^ char.charCodeAt(0)) >>> 0;
  return hash.toString(36);
}

/** The empty add form suggests the usual first line; a stored $0 line would look like a real price. */
const FIRST_LINE = { description: "Preventive maintenance visit", visitMonths: [], costPerVisit: "", assetTypeIds: [] };
const NEXT_LINE = { description: "", visitMonths: [], costPerVisit: "", assetTypeIds: [] };

const date = new Intl.DateTimeFormat("en-CA", { dateStyle: "medium", timeZone: "America/Vancouver" });

const link = "inline-flex min-h-11 items-center font-medium text-action lg:min-h-0";
const panel = "rounded-panel border border-hairline bg-surface shadow-card";

/** Whether the link email went out (outbox-dispatch AC 30); no notification yet reads as pending. */
function deliveryLine(email: LinkEmailView | null): string {
  if (email?.status === "sent") return `Emailed to ${email.to} on ${date.format(email.sentAt)}`;
  if (email?.status === "not_sent") return `Not emailed: ${notEmailedWords(email.reason)}`;
  return "Email pending";
}

/** One step of the send checklist: done or still to do, with a link to where it is done. */
function Step({ done, children, href }: { done: boolean; children: ReactNode; href?: string }) {
  return (
    <li className="flex items-start gap-2.5 text-[13px]">
      <span
        aria-hidden="true"
        className={`mt-px flex size-[18px] shrink-0 items-center justify-center rounded-full ${done ? "bg-stage-completed text-surface" : "border border-field bg-surface"}`}
      >
        {done && <Icon name="check" className="size-3" />}
      </span>
      <span className={done ? "text-ink-2" : "font-medium text-ink"}>
        <span className="sr-only">{done ? "Done: " : "To do: "}</span>
        {href && !done ? (
          <a href={href} className="-my-3 inline-flex min-h-11 items-center underline decoration-hairline underline-offset-2 hover:decoration-action lg:my-0 lg:min-h-0">
            {children}
          </a>
        ) : (
          children
        )}
      </span>
    </li>
  );
}

/**
 * The agreement page: who and where, then the work in two columns from desktop. The main column holds what the agreement
 * says (recommended plan, service lines, the year's visits, term, scope); the side rail holds where it stands (the total,
 * what is left before it can be sent, the document as the customer gets it, the template). Phones read it top to bottom
 * with the rail's summary first.
 */
export function AgreementView({ agreement, role, actions, words = DEFAULT_ITEM_WORDS, skippedCodes = [], recipient, templateChoices }: AgreementViewProps) {
  const writer = canWriteRecords(role) ? actions : undefined;
  const { shown } = agreement;
  const latest = agreement.versions[0]?.versionNo ?? shown.versionNo;
  const label = labelFor(agreement.stage, agreement.status);
  const lineActions = writer && agreement.editable ? writer : undefined;
  const canRevise = writer && agreement.status === "changes_requested";
  const canWithdraw = writer && (agreement.status === "draft" || agreement.status === "sent");
  const canSend = writer !== undefined && agreement.editable;
  const firstViewed = agreement.portalLink?.firstViewedAt ?? null;
  const canGenerate = writer?.generate !== undefined && agreement.status === "accepted" && !agreement.contract;
  const uncovered = agreement.editable ? (agreement.scopeDraft?.uncovered ?? []) : [];
  const recommended = shown.lines.filter((line) => line.recommended).length;
  const visits = shown.lines.reduce((sum, line) => sum + line.visitsPerYear, 0);
  const hasEquipment = agreement.equipmentChoices.length > 0 || (agreement.serviceScope.source !== "not_recorded" && agreement.serviceScope.types.length > 0);

  const versionLine = shown.current ? `Version ${shown.versionNo}` : `Version ${shown.versionNo} of ${latest}, read-only`;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <nav aria-label="Agreement for" className="flex flex-wrap items-center gap-x-1.5 text-[13px] text-ink-2">
          <Link href={`/customers/${agreement.customer.id}`} className={link}>
            {agreement.customer.name}
          </Link>
          <Icon name="chevron" className="size-3.5" />
          <Link href={`/sites/${agreement.site.id}`} className={link}>
            {agreement.site.name}
          </Link>
          {agreement.renews && (
            <>
              <span aria-hidden="true" className="px-1">·</span>
              <Link href={`/agreements/${agreement.renews.id}`} className={link}>
                Renewal of {agreement.renews.number}
              </Link>
            </>
          )}
          {agreement.renewedBy && (
            <>
              <span aria-hidden="true" className="px-1">·</span>
              <Link href={`/agreements/${agreement.renewedBy.id}`} className={link}>
                Renewed by {agreement.renewedBy.number}
              </Link>
            </>
          )}
        </nav>
        <PageHeader
          title={agreement.number}
          badge={agreement.stage ? <StatusPill stage={agreement.stage} label={label} /> : <StatusPill tone="neutral" label={label} />}
          subtitle={
            <>
              {versionLine}
              {shown.current && agreement.status !== "draft" && ` · ${label}, read-only`}
              {` · ${formatCadExact(shown.annualCents)}/yr before tax`}
            </>
          }
          action={
            canRevise || canWithdraw ? (
              <div className="flex flex-wrap items-start gap-2.5">
                {canRevise && <ReviseControl nextVersion={latest + 1} action={writer.revise} />}
                {canWithdraw && <WithdrawControl number={agreement.number} action={writer.withdraw} />}
              </div>
            ) : undefined
          }
        />
      </div>

      {canGenerate && writer.generate && (
        <GenerateContractControl signer={agreement.signer ?? null} term={agreement.term} annualCents={shown.annualCents} action={writer.generate} />
      )}

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_23rem]">
        <div className="flex min-w-0 flex-col gap-5 lg:order-1">
          {lineActions?.recommend && uncovered.length > 0 && (
            <RecommendPanel uncovered={uncovered} hasLines={shown.lines.length > 0} recommend={lineActions.recommend} words={words} />
          )}

          {skippedCodes.length > 0 && (
            <p role="status" className="rounded-control bg-attention-bg px-3 py-2 text-[13px] font-medium text-attention-fg">
              {itemText("These equipment types are not in your catalog and were left off: ", words) + skippedCodes.join(", ")}
            </p>
          )}

          {agreement.compare && <VersionCompare fromNo={agreement.compare.versionNo} toNo={shown.versionNo} from={agreement.compare.lines} to={shown.lines} words={words} />}

          <section aria-label="Service lines" className={`overflow-hidden ${panel}`}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 pt-4 pb-3">
              <h2 className="font-display text-[16px] font-semibold tracking-tight">Service lines</h2>
              <p className="text-[12px] text-ink-2">
                {shown.lines.length === 0 ? "None yet" : `${shown.lines.length} ${shown.lines.length === 1 ? "line" : "lines"} · ${visits} visits a year`}
              </p>
            </div>
            {recommended > 0 && <ReviewBar count={recommended} keepAll={lineActions?.keepAll} />}
            {shown.lines.length === 0 ? (
              <p className="border-t border-hairline px-4 py-8 text-center text-[13px] text-ink-2">
                {lineActions && uncovered.length > 0 ? "No service lines yet. Add the recommended lines above, or add one below." : "No service lines yet."}
              </p>
            ) : (
              <ul className="divide-y divide-hairline border-t border-hairline">
                {shown.lines.map((line) => (
                  <LineRow
                    key={line.id}
                    line={line}
                    choices={agreement.equipmentChoices}
                    words={words}
                    actions={
                      lineActions && {
                        update: lineActions.update(line.id),
                        remove: lineActions.remove(line.id),
                        ...(lineActions.keep && { keep: lineActions.keep(line.id) }),
                      }
                    }
                  />
                ))}
              </ul>
            )}
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-t border-hairline bg-ground px-4 py-3">
              <p className="text-[14px] font-semibold">
                Total per year <span>{formatCadExact(shown.annualCents)}</span>
              </p>
              <p className="text-[12px] text-ink-2">Before tax</p>
            </div>
            {lineActions && (
              <div className="border-t border-hairline">
                {agreement.equipmentChoices.length === 0 ? (
                  // A line covers at least one equipment type (cadence AC 13), so the site needs some first.
                  <p className="px-4 py-3 text-[13px] text-ink-2">
                    <Link href={`/sites/${agreement.site.id}`} className={link}>
                      {`Add ${words.plural} to this site before adding a service line`}
                    </Link>
                  </p>
                ) : (
                  <details className="group" open={shown.lines.length === 0 && uncovered.length === 0}>
                    <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-4 text-[13px] font-semibold text-action lg:min-h-10 [&::-webkit-details-marker]:hidden">
                      <Icon name="plus" className="size-4 transition-transform duration-150 group-open:rotate-45" />
                      Add a line
                    </summary>
                    <section aria-label="Add a line" className="border-t border-hairline px-4 py-3">
                      <LineFormControl
                        idPrefix="new-line"
                        initial={shown.lines.length === 0 ? FIRST_LINE : NEXT_LINE}
                        choices={agreement.equipmentChoices}
                        words={words}
                        submitLabel="Add line"
                        action={lineActions.add}
                      />
                    </section>
                  </details>
                )}
              </div>
            )}
          </section>

          <VisitCalendar words={words} lines={shown.lines} schedule={visitSchedule(shown.lines, agreement.serviceScope.source === "not_recorded" ? [] : agreement.serviceScope.types)} />

          <div id="term" className="grid scroll-mt-24 gap-5 xl:grid-cols-2">
            <TermSection term={agreement.term} action={lineActions?.saveTerm} />
            {lineActions && <NoteSection note={agreement.versions.find((version) => version.versionNo === shown.versionNo)?.reason ?? null} action={lineActions.saveNote} />}
          </div>

          {agreement.editable && agreement.scopeDraft && (
            <ScopeControls controls={agreement.scopeDraft.controls} uncovered={agreement.scopeDraft.uncovered} setExcluded={writer?.setExcluded} words={words} />
          )}

          <ServiceScopeSections
            scope={agreement.serviceScope}
            siteId={agreement.site.id}
            canAddEquipment={canWriteRecords(role)}
            noLinesYet={agreement.editable && shown.lines.length === 0 && uncovered.length > 0}
            lines={shown.lines}
            words={words}
          />

          {hasVersionStory(agreement.versions) && (
            <VersionsSection
              agreementId={agreement.id}
              versions={agreement.versions}
              shownNo={shown.versionNo}
              sentVersion={agreement.sentVersion}
              acceptedVersion={agreement.acceptedVersion}
              comparedNo={agreement.compare?.versionNo ?? null}
            />
          )}

          {agreement.timeline && agreement.timeline.length > 0 && <ActivitySection timeline={agreement.timeline} />}
        </div>

        <aside aria-label="Agreement summary" className="order-first flex flex-col gap-4 lg:sticky lg:top-6 lg:order-2">
          <section aria-label="Total" className="flex flex-col gap-3 rounded-panel bg-night p-4 text-surface shadow-panel">
            <div className="flex flex-col gap-0.5">
              <p className="text-[12px] font-medium text-night-ink">Total per year, before tax</p>
              <p className="font-display text-[30px] leading-tight font-semibold tracking-tight">{formatCadExact(shown.annualCents)}</p>
            </div>
            <dl className="grid grid-cols-3 gap-2 border-t border-surface/10 pt-3 text-[12px]">
              <div>
                <dt className="text-night-ink">Lines</dt>
                <dd className="text-[14px] font-semibold">{shown.lines.length}</dd>
              </div>
              <div>
                <dt className="text-night-ink">Visits/yr</dt>
                <dd className="text-[14px] font-semibold">{visits}</dd>
              </div>
              <div>
                <dt className="text-night-ink">Term</dt>
                <dd className="text-[14px] font-semibold">{`${agreement.term.months} mo`}</dd>
              </div>
            </dl>
          </section>

          {(canSend || agreement.status !== "draft") && (
            <section aria-label="Status" className={`flex flex-col gap-3 p-4 ${panel}`}>
              <h2 className="font-display text-[16px] font-semibold tracking-tight">{canSend ? "Ready to send?" : "Status"}</h2>
              {canSend && (
                <ul className="flex flex-col gap-2">
                  <Step done={hasEquipment} href={`/sites/${agreement.site.id}`}>
                    {itemText("Equipment on the site", words)}
                  </Step>
                  <Step done={shown.lines.length > 0}>At least one service line</Step>
                  <Step done={recommended === 0}>{recommended === 0 ? "Prices reviewed" : `Review ${recommended} recommended ${recommended === 1 ? "line" : "lines"}`}</Step>
                  <Step done={agreement.term.start !== null} href="#term">
                    {agreement.term.start ? `Starts ${formatTermDate(agreement.term.start)}` : "Set the term start date"}
                  </Step>
                  <Step done={Boolean(recipient)}>{recipient ? `Goes to ${recipient}` : "Customer email (asked when you send)"}</Step>
                </ul>
              )}
              {writer && canSend && <LinkControls number={agreement.number} canSend={canSend} recipient={recipient ?? null} send={writer.send} words={words} />}
              {agreement.status === "sent" && shown.current && (
                <div className="flex flex-col gap-1 text-[13px] text-ink-2">
                  <p>{firstViewed ? `Viewed by the customer on ${date.format(firstViewed)}` : "Not viewed yet"}</p>
                  <p className="break-words">{deliveryLine(agreement.linkEmail)}</p>
                  {agreement.validUntil && <p>Valid until {formatTermDate(agreement.validUntil)}</p>}
                </div>
              )}
              {agreement.status === "expired" && shown.current && agreement.validUntil && (
                <p className="text-[13px] text-ink-2">Expired · was valid until {formatTermDate(agreement.validUntil)}</p>
              )}
              {!canSend && agreement.status !== "sent" && agreement.status !== "expired" && <p className="text-[13px] text-ink-2">{`${label}. ${versionLine}.`}</p>}
              {agreement.contract && (
                <p data-contract className="text-[13px] text-ink-2">
                  Contract: {CONTRACT_STATUS_META[agreement.contract.status].label} ·{" "}
                  <Link href={`/contracts/${agreement.contract.id}`} className={link}>
                    Open contract
                  </Link>
                </p>
              )}
            </section>
          )}

          <AgreementPdfPreview
            agreementId={agreement.id}
            versionNo={shown.versionNo}
            number={agreement.number}
            revision={revisionOf([shown.lines, shown.annualCents, agreement.term, agreement.status, agreement.templateVersionId ?? null])}
          />

          {agreement.template && (
            <TemplatePicker
              name={agreement.template.name}
              choices={agreement.editable ? templateChoices?.choices : undefined}
              selectedVersionId={agreement.editable ? templateChoices?.selected : undefined}
              change={agreement.editable ? writer?.setTemplate : undefined}
            />
          )}
        </aside>
      </div>
    </div>
  );
}
