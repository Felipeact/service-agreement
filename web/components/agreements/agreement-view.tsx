import Link from "next/link";
import type { AgreementDetail, LinkEmailView, MemberRole } from "@/application/ports";
import { canWriteRecords } from "@/components/records/state";
import { PageHeader } from "@/components/shell/page-header";
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
import { ServiceScopeSections } from "./service-scope";
import { AgreementPdfPreview } from "./agreement-pdf-preview";
import { LinkControls } from "./link-controls";
import { NoteSection } from "./note-section";
import { TermSection } from "./term-section";
import { VersionCompare } from "./version-compare";
import { ActivitySection } from "./activity-section";
import { VersionsSection, hasVersionStory } from "./versions-section";
import { VisitScheduleSection } from "./visit-schedule";
import type { GenerateContractState } from "./contract-state";
import type { LineState, LinkState, MoveState, NoteState, TermState } from "./state";

/** The page's Server Actions, bound to this agreement (or, for line writes, to one line). */
export type AgreementActions = {
  add: (formData: FormData) => Promise<LineState>;
  update: (lineId: string) => (formData: FormData) => Promise<LineState>;
  remove: (lineId: string) => () => Promise<LineState>;
  revise: () => Promise<MoveState>;
  withdraw: () => Promise<MoveState>;
  send: (email?: string) => Promise<LinkState>;
  /** No longer offered on the page (the customer gets the link by email); kept so older callers still type-check. */
  reissue?: () => Promise<LinkState>;
  saveTerm: (formData: FormData) => Promise<TermState>;
  saveNote: (formData: FormData) => Promise<NoteState>;
  /** Optional so a page without contracts (and older fixtures) still compiles; the agreement page always binds it. */
  generate?: () => Promise<GenerateContractState>;
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

/** Whether the link email went out (outbox-dispatch AC 30); no notification yet reads as pending. */
function deliveryLine(email: LinkEmailView | null): string {
  if (email?.status === "sent") return `Emailed to ${email.to} on ${date.format(email.sentAt)}`;
  if (email?.status === "not_sent") return `Not emailed: ${notEmailedWords(email.reason)}`;
  return "Email pending";
}

/** The agreement page body: who and where, the version shown, its lines and total, and the versions list. */
export function AgreementView({ agreement, role, actions, words = DEFAULT_ITEM_WORDS, skippedCodes = [], recipient }: AgreementViewProps) {
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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-x-3 text-[13px]">
          <Link href={`/customers/${agreement.customer.id}`} className={link}>
            {agreement.customer.name}
          </Link>
          <Link href={`/sites/${agreement.site.id}`} className={link}>
            {agreement.site.name}
          </Link>
          {agreement.renews && (
            <Link href={`/agreements/${agreement.renews.id}`} className={link}>
              Renewal of {agreement.renews.number}
            </Link>
          )}
          {agreement.renewedBy && (
            <Link href={`/agreements/${agreement.renewedBy.id}`} className={link}>
              Renewed by {agreement.renewedBy.number}
            </Link>
          )}
          {/* A file download, not a page: a plain anchor so the browser saves it. */}
          <a href={`/agreements/${agreement.id}/pdf?version=${shown.versionNo}`} className={link}>
            Download PDF
          </a>
        </div>
        <PageHeader
          title={agreement.number}
          badge={agreement.stage ? <StatusPill stage={agreement.stage} label={label} /> : <StatusPill tone="neutral" label={label} />}
          action={
            canRevise || canWithdraw ? (
              <div className="flex flex-wrap items-start gap-2.5">
                {canRevise && <ReviseControl nextVersion={latest + 1} action={writer.revise} />}
                {canWithdraw && <WithdrawControl number={agreement.number} action={writer.withdraw} />}
              </div>
            ) : undefined
          }
        />
        <p className="text-[13px] text-ink-2">
          {shown.current ? `Version ${shown.versionNo}` : `Version ${shown.versionNo} of ${latest}, read-only`}
          {shown.current && agreement.status !== "draft" && ` · ${label}, read-only`}
        </p>
        {agreement.status === "sent" && shown.current && (
          <>
            <p className="text-[13px] text-ink-2">{firstViewed ? `Viewed by the customer on ${date.format(firstViewed)}` : "Not viewed yet"}</p>
            <p className="break-words text-[13px] text-ink-2">{deliveryLine(agreement.linkEmail)}</p>
            {agreement.validUntil && <p className="text-[13px] text-ink-2">Valid until {formatTermDate(agreement.validUntil)}</p>}
          </>
        )}
        {agreement.status === "expired" && shown.current && agreement.validUntil && (
          <p className="text-[13px] text-ink-2">Expired · was valid until {formatTermDate(agreement.validUntil)}</p>
        )}
        {agreement.contract && (
          <p data-contract className="text-[13px] text-ink-2">
            Contract: {CONTRACT_STATUS_META[agreement.contract.status].label} ·{" "}
            <Link href={`/contracts/${agreement.contract.id}`} className={link}>
              Open contract
            </Link>
          </p>
        )}
      </div>

      {canGenerate && writer.generate && (
        <GenerateContractControl signer={agreement.signer ?? null} term={agreement.term} annualCents={shown.annualCents} action={writer.generate} />
      )}

      {writer && canSend && <LinkControls number={agreement.number} canSend={canSend} recipient={recipient ?? null} send={writer.send} />}

      <AgreementPdfPreview agreementId={agreement.id} versionNo={shown.versionNo} revision={revisionOf([shown.lines, shown.annualCents, agreement.term, agreement.status])} />

      {agreement.compare && <VersionCompare fromNo={agreement.compare.versionNo} toNo={shown.versionNo} from={agreement.compare.lines} to={shown.lines} words={words} />}

      <TermSection term={agreement.term} action={lineActions?.saveTerm} />

      {lineActions && <NoteSection note={agreement.versions.find((version) => version.versionNo === shown.versionNo)?.reason ?? null} action={lineActions.saveNote} />}

      {skippedCodes.length > 0 && (
        <p role="status" className="rounded-control bg-attention-bg px-3 py-2 text-[13px] font-medium text-attention-fg">
          {itemText("These equipment types are not in your catalog and were left off: ", words) + skippedCodes.join(", ")}
        </p>
      )}

      <section aria-label="Service lines" className="overflow-hidden rounded-panel border border-hairline bg-surface">
        <h2 className="border-b border-hairline bg-ground px-4 py-2 text-[13px] font-semibold">Service lines</h2>
        {shown.lines.length === 0 ? (
          <p className="px-4 py-6 text-center text-[13px] text-ink-2">No service lines yet.</p>
        ) : (
          <>
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
              {shown.lines.map((line) => (
                <LineRow
                  key={line.id}
                  line={line}
                  choices={agreement.equipmentChoices}
                  words={words}
                  actions={lineActions && { update: lineActions.update(line.id), remove: lineActions.remove(line.id) }}
                />
              ))}
            </ul>
          </>
        )}
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-t border-hairline px-4 py-3">
          <p className="text-[14px] font-semibold">
            Total per year <span>{formatCadExact(shown.annualCents)}</span>
          </p>
          <p className="text-[12px] text-ink-2">Before tax</p>
        </div>
      </section>

      {lineActions && (
        <section aria-label="Add a line" className="rounded-panel border border-hairline bg-surface px-4 py-3">
          {agreement.equipmentChoices.length === 0 ? (
            // A line covers at least one equipment type (cadence AC 13), so the site needs some first.
            <p className="text-[13px] text-ink-2">
              <Link href={`/sites/${agreement.site.id}`} className={link}>
                {`Add ${words.plural} to this site before adding a service line`}
              </Link>
            </p>
          ) : (
            <LineFormControl
              idPrefix="new-line"
              initial={shown.lines.length === 0 ? FIRST_LINE : NEXT_LINE}
              choices={agreement.equipmentChoices}
              words={words}
              submitLabel="Add line"
              action={lineActions.add}
            />
          )}
        </section>
      )}

      <VisitScheduleSection schedule={visitSchedule(shown.lines, agreement.serviceScope.source === "not_recorded" ? [] : agreement.serviceScope.types)} />

      <ServiceScopeSections
        scope={agreement.serviceScope}
        siteId={agreement.site.id}
        canAddEquipment={canWriteRecords(role)}
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
  );
}
