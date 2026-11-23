import Link from "next/link";
import { DownloadIcon, EyeIcon } from "lucide-react";
import type { AgreementDetail, LinkEmailView, MemberRole } from "@/application/ports";
import type { PipelineStage } from "@/domain/pipeline";
import { canWriteRecords } from "@/components/records/state";
import { labelFor } from "@/domain/agreement";
import { CONTRACT_STATUS_META } from "@/domain/contract";
import { formatTermDate } from "@/domain/agreement/term";
import { notEmailedWords } from "@/domain/notifications";
import { DEFAULT_ITEM_WORDS, itemText, type ItemWords } from "@/domain/org-settings";
import { DEFAULT_RATES } from "@/domain/agreement/service-plan";
import { isSectionDone, sendReadiness, type ReadinessTarget } from "@/domain/agreement/readiness";
import type { SiteEditState } from "../_actions/site";
import { GenerateContractControl } from "./contract-controls";
import { ReviewBanner, ReviewButton, ReviewProvider } from "./review-lines";
import { ReviseControl, WithdrawControl } from "./move-controls";
import type { TemplateChoice } from "./template-choice";
import { BeforeYouSend } from "./before-you-send";
import { CustomerPreview } from "./customer-preview";
import { EquipmentSection, type SiteType } from "./site-types";
import { GoesTo } from "./goes-to";
import { FactsStrip, GuidedSection } from "./guided";
import { LinesSection, type LinesActions } from "./lines-section";
import { linkButton, money, secondaryButton, units } from "./styles";
import { TermFields } from "./term-fields";
import { NoteSection } from "./note-section";
import { VersionCompare } from "./version-compare";
import { ActivitySection } from "./activity-section";
import { VersionsSection, hasVersionStory } from "./versions-section";
import { ProgressSteps } from "./progress-steps";
import type { GenerateContractState } from "@/components/agreements/contract-state";
import type { ApplyReviewState, GenerateLinesState, LineState, ReviewState, LinkState, MoveState, NoteState, ScopeState, TemplateState, TermState } from "@/components/agreements/state";

/** The page's Server Actions, bound to this agreement (or, for line writes, to one line). */
export type AgreementActions = {
  add: (formData: FormData) => Promise<LineState>;
  update: (lineId: string) => (formData: FormData) => Promise<LineState>;
  remove: (lineId: string) => () => Promise<LineState>;
  revise: () => Promise<MoveState>;
  withdraw: () => Promise<MoveState>;
  send: (email?: string, confirmUncovered?: boolean, confirmStart?: boolean) => Promise<LinkState>;
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
  /** Builds a service line for each equipment type no line covers yet. Optional so older fixtures compile. */
  generateLines?: () => Promise<GenerateLinesState>;
  /** Sets a site type's count and location, or adds a type (the Equipment section). Optional so older fixtures compile. */
  setTypeCount?: (input: { siteId: string; assetTypeId: string; count: number; location: string | null }) => Promise<SiteEditState>;
  /** Changes who the agreement goes to (the site contact's name and email). Optional so older fixtures compile. */
  setContact?: (input: { siteId: string; name: string; email: string }) => Promise<SiteEditState>;
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
  /** "Review with AI" and its "Apply all", bound to this agreement; offered to writers on an editable draft. */
  review?: { review: () => Promise<ReviewState>; apply: (proposal: unknown) => Promise<ApplyReviewState> };
  /** The company as the agreement prints it, and whether it is confirmed for sending; absent in older fixtures. */
  company?: { name: string | null; address: string | null; phone: string | null; ready: boolean };
  /** A draft's site equipment by type (active units, shared location), for the Equipment section; empty otherwise. */
  siteEquipment?: SiteType[];
  /** The org's types the site does not have, for "Add equipment". */
  addableTypes?: { id: string; name: string }[];
  /** The site contact's name and the site's address, for "Goes to". */
  contactName?: string | null;
  siteAddress?: string | null;
};

/** A short fingerprint of what the PDF would say, so an open preview knows when to redraw. */
function revisionOf(value: unknown): string {
  let hash = 5381;
  for (const char of JSON.stringify(value)) hash = ((hash * 33) ^ char.charCodeAt(0)) >>> 0;
  return hash.toString(36);
}

const date = new Intl.DateTimeFormat("en-CA", { dateStyle: "medium", timeZone: "America/Vancouver" });

const link = "inline-flex min-h-11 items-center font-medium text-action hover:underline lg:min-h-0";

/** The stage pill of the approved design, in the stage's own pill colours. */
const PILL: Record<PipelineStage, string> = {
  in_progress: "border-pill-in-progress-border bg-pill-in-progress text-pill-in-progress-ink",
  sent: "border-pill-sent-border bg-pill-sent text-pill-sent-ink",
  accepted: "border-pill-accepted-border bg-pill-accepted text-pill-accepted-ink",
  completed: "border-pill-completed-border bg-pill-completed text-pill-completed-ink",
  refused: "border-pill-refused-border bg-pill-refused text-pill-refused-ink",
};

/** Whether the link email went out (outbox-dispatch AC 30); no notification yet reads as pending. */
function deliveryLine(email: LinkEmailView | null): string {
  if (email?.status === "sent") return `Emailed to ${email.to} on ${date.format(email.sentAt)}`;
  if (email?.status === "not_sent") return `Not emailed: ${notEmailedWords(email.reason)}`;
  return "Email pending";
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/**
 * The agreement page, built as an exact copy of the approved preview (/concepts/agreement, 2026-11-23): the header and facts
 * strip, then the guided sections a draft is finished in (Equipment, Service lines and prices, Term, Your company), each with the
 * tick of its item in "Before you send", and last "What the customer gets", the real PDF in the pinned template. The card and
 * "Goes to" sit on the right, with the versions, note and activity under them (kept by the owner's choice).
 */
export function AgreementView({
  agreement,
  role,
  actions,
  words = DEFAULT_ITEM_WORDS,
  skippedCodes = [],
  recipient,
  templateChoices,
  review,
  company,
  siteEquipment = [],
  addableTypes = [],
  contactName = null,
  siteAddress = null,
}: AgreementViewProps) {
  const writer = canWriteRecords(role) ? actions : undefined;
  const { shown } = agreement;
  const latest = agreement.versions[0]?.versionNo ?? shown.versionNo;
  const label = labelFor(agreement.stage, agreement.status);
  const lineActions = writer && agreement.editable ? writer : undefined;
  const canRevise = writer && agreement.status === "changes_requested";
  const canWithdraw = writer && (agreement.status === "draft" || agreement.status === "sent");
  const isDraftView = agreement.status === "draft" && shown.current;
  const firstViewed = agreement.portalLink?.firstViewedAt ?? null;
  const canGenerate = writer?.generate !== undefined && agreement.status === "accepted" && !agreement.contract;
  const revision = revisionOf([shown.lines, shown.annualCents, agreement.term, agreement.status, agreement.templateVersionId ?? null]);

  const scopeTypes = agreement.serviceScope.source === "not_recorded" ? [] : agreement.serviceScope.types;
  const choices = agreement.equipmentChoices;
  const onSite = choices.filter((type) => (type.units ?? 0) > 0);
  const siteUnits = onSite.reduce((sum, type) => sum + (type.units ?? 0), 0);
  const uncovered = agreement.scopeDraft?.uncovered ?? [];
  const covered = new Set(shown.lines.flatMap((line) => line.equipment.map((type) => type.id)));
  const coveredUnits = agreement.editable ? onSite.filter((type) => covered.has(type.id)).reduce((sum, type) => sum + (type.units ?? 0), 0) : scopeTypes.reduce((sum, type) => sum + type.assets.length, 0);
  const unpriced = shown.lines.filter((line) => line.costPerVisitCents <= 0).length;

  const readiness =
    lineActions && agreement.scopeDraft
      ? sendReadiness({
          equipment: onSite.map((type) => ({ units: type.units ?? 0 })),
          uncovered,
          linePrices: shown.lines.map((line) => line.costPerVisitCents),
          termStart: agreement.term.start,
          company: { ready: company?.ready ?? false, name: company?.name ?? null },
          hourlyRateCents: DEFAULT_RATES.hourlyRateCents,
        })
      : null;
  const doneFor = (target: ReadinessTarget) => (readiness ? isSectionDone(readiness, target) : undefined);

  const linesActions: LinesActions | undefined = lineActions
    ? { add: lineActions.add, lines: Object.fromEntries(shown.lines.map((line) => [line.id, { update: lineActions.update(line.id), remove: lineActions.remove(line.id) }])) }
    : undefined;
  const lineState =
    agreement.editable && uncovered.length > 0
      ? `${plural(uncovered.length, "kind", "kinds")} not on a line`
      : unpriced > 0
        ? `${unpriced} at $0`
        : shown.lines.length === 0
          ? "No service lines yet"
          : `${plural(shown.lines.length, "visit plan", "visit plans")}, all priced`;

  return (
    <ReviewProvider actions={lineActions ? review : undefined}>
      <div className="flex flex-col gap-6">
        <header className="flex flex-col gap-4">
          <Link href="/agreements" className="inline-flex min-h-11 w-fit items-center text-[13px] font-semibold text-action hover:underline lg:min-h-8">
            Agreements
          </Link>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-[30px] leading-none font-extrabold tracking-tight sm:text-[34px]">{agreement.number}</h1>
                <span className={`rounded-full border px-2.5 py-0.5 text-[12px] font-semibold ${agreement.stage ? PILL[agreement.stage] : "border-hairline bg-board text-ink-2"}`}>{label}</span>
              </div>
              <p className="text-[15px] text-ink-nav">
                <Link href={`/customers/${agreement.customer.id}`} className={link}>
                  {agreement.customer.name}
                </Link>
                , {agreement.site.name}
                {agreement.renews && (
                  <>
                    {", "}
                    <Link href={`/agreements/${agreement.renews.id}`} className={link}>
                      Renewal of {agreement.renews.number}
                    </Link>
                  </>
                )}
                {agreement.renewedBy && (
                  <>
                    {", "}
                    <Link href={`/agreements/${agreement.renewedBy.id}`} className={link}>
                      Renewed by {agreement.renewedBy.number}
                    </Link>
                  </>
                )}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <a href="#preview" className={secondaryButton}>
                <EyeIcon className="size-4" aria-hidden="true" /> Preview
              </a>
              {/* A file download, not a page: a plain anchor so the browser saves it. */}
              <a href={`/agreements/${agreement.id}/pdf?version=${shown.versionNo}`} className={secondaryButton}>
                <DownloadIcon className="size-4" aria-hidden="true" /> PDF
              </a>
              <ReviewButton />
              {canRevise && <ReviseControl nextVersion={latest + 1} action={writer.revise} />}
              {canWithdraw && !isDraftView && <WithdrawControl number={agreement.number} action={writer.withdraw} />}
            </div>
          </div>
          {!isDraftView && (
            <div className="flex flex-col gap-1 text-[13px] text-ink-2">
              <p>{shown.current ? `Version ${shown.versionNo}. ${label}, read-only` : `Version ${shown.versionNo} of ${latest}, read-only`}</p>
              {agreement.status === "sent" && shown.current && (
                <>
                  <p>{firstViewed ? `Viewed by the customer on ${date.format(firstViewed)}` : "Not viewed yet"}</p>
                  <p className="break-words">{deliveryLine(agreement.linkEmail)}</p>
                  {agreement.validUntil && <p>Valid until {formatTermDate(agreement.validUntil)}</p>}
                </>
              )}
              {agreement.status === "expired" && shown.current && agreement.validUntil && <p>Expired, was valid until {formatTermDate(agreement.validUntil)}</p>}
              {agreement.contract && (
                <p data-contract>
                  Contract: {CONTRACT_STATUS_META[agreement.contract.status].label}.{" "}
                  <Link href={`/contracts/${agreement.contract.id}`} className={link}>
                    Open contract
                  </Link>
                </p>
              )}
            </div>
          )}
        </header>

        <FactsStrip
          facts={[
            { label: "Worth a year", value: money(shown.annualCents), note: "Before tax" },
            { label: "Visits a year", value: String(shown.lines.reduce((sum, line) => sum + line.visitsPerYear, 0)), note: plural(shown.lines.length, "visit plan", "visit plans") },
            {
              label: `${words.Plural} covered`,
              value: agreement.serviceScope.source === "not_recorded" && !agreement.editable ? "Not recorded" : units(coveredUnits),
              note: agreement.editable ? `${onSite.filter((type) => covered.has(type.id)).length} of ${onSite.length} kinds` : plural(scopeTypes.length, "kind", "kinds"),
            },
            {
              label: "Term",
              value: plural(agreement.term.months, "month", "months"),
              note: agreement.term.start ? `Starts ${formatTermDate(agreement.term.start)}` : "Start date not set",
              isOpen: agreement.editable && agreement.term.start === null,
            },
          ]}
        />

        <ReviewBanner />

        {!isDraftView && agreement.stage && <ProgressSteps stage={agreement.stage} />}

        {canGenerate && writer.generate && (
          <GenerateContractControl signer={agreement.signer ?? null} term={agreement.term} annualCents={shown.annualCents} action={writer.generate} />
        )}

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="flex min-w-0 flex-col gap-5">
            {agreement.compare && <VersionCompare fromNo={agreement.compare.versionNo} toNo={shown.versionNo} from={agreement.compare.lines} to={shown.lines} words={words} />}

            {skippedCodes.length > 0 && (
              <p role="status" className="rounded-control bg-attention-bg px-3 py-2 text-[13px] font-medium text-attention-fg">
                {itemText("These equipment types are not in your catalog and were left off: ", words) + skippedCodes.join(", ")}
              </p>
            )}

            {lineActions && writer?.setTypeCount ? (
              <EquipmentSection
                section={{ id: "site", label: `${words.Plural} on site`, title: words.Plural, state: `${plural(onSite.length, "kind", "kinds")}, ${plural(siteUnits, "unit", "units")} on site`, isDone: doneFor("site") }}
                siteId={agreement.site.id}
                types={siteEquipment}
                addable={addableTypes}
                setCount={writer.setTypeCount}
                words={words}
              />
            ) : (
              <GuidedSection id="site" label={`${words.Plural} on site`} title={words.Plural} state={`${plural(scopeTypes.length, "kind", "kinds")}, ${plural(coveredUnits, "unit", "units")} covered`}>
                <ul className="divide-y divide-hairline">
                  {scopeTypes.map((type) => (
                    <li key={type.code} className="flex items-center justify-between gap-3 px-5 py-2 text-[14px]">
                      <span className="font-medium">{type.name}</span>
                      <span className="tabular-nums text-ink-2">{units(type.assets.length)}</span>
                    </li>
                  ))}
                </ul>
              </GuidedSection>
            )}

            <LinesSection section={{ state: lineState, isDone: doneFor("lines") }} lines={shown.lines} choices={choices} uncovered={agreement.editable ? uncovered : []} totalCents={shown.annualCents} actions={linesActions} words={words} />

            <GuidedSection id="term" title="Term" state={agreement.term.start ? "Set" : agreement.editable ? "Start date missing" : "Start date not set"} isDone={doneFor("term")}>
              <TermFields key={`${agreement.term.start}:${agreement.term.months}`} term={agreement.term} action={lineActions?.saveTerm} />
            </GuidedSection>

            <GuidedSection id="company" title="Your company on the agreement" state={company?.ready ? "Confirmed" : company ? "Needs checking" : undefined} isDone={doneFor("company")}>
              <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 text-[14px]">
                <p className="min-w-0">
                  <span className="font-semibold">{company?.name ?? "No company name yet"}</span>
                  <span className="block break-words text-ink-2">{[company?.address, company?.phone].filter(Boolean).join(", ") || "Add the address and phone in Settings"}</span>
                </p>
                {canWriteRecords(role) && (
                  <Link href="/settings" className={linkButton}>
                    Edit in Settings
                  </Link>
                )}
              </div>
            </GuidedSection>

            <CustomerPreview
              agreementId={agreement.id}
              versionNo={shown.versionNo}
              revision={revision}
              reader={contactName ?? agreement.customer.name}
              templateName={agreement.template?.name ?? null}
              choices={agreement.editable ? templateChoices?.choices : undefined}
              selected={agreement.editable ? templateChoices?.selected : undefined}
              change={agreement.editable ? writer?.setTemplate : undefined}
            />
          </div>

          <aside aria-label="Send and history" className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-20">
            {lineActions && readiness && (
              <BeforeYouSend number={agreement.number} items={readiness} term={agreement.term} recipient={recipient ?? null} words={words} saveTerm={lineActions.saveTerm} send={lineActions.send} />
            )}
            {lineActions?.setContact && <GoesTo siteId={agreement.site.id} name={contactName} email={recipient ?? null} address={siteAddress} change={lineActions.setContact} />}

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

            {lineActions && <NoteSection note={agreement.versions.find((version) => version.versionNo === shown.versionNo)?.reason ?? null} action={lineActions.saveNote} />}
            {agreement.timeline && agreement.timeline.length > 0 && <ActivitySection timeline={agreement.timeline} />}
            {canWithdraw && isDraftView && (
              <div className="flex justify-end">
                <WithdrawControl number={agreement.number} action={writer.withdraw} />
              </div>
            )}
          </aside>
        </div>
      </div>
    </ReviewProvider>
  );
}
