import Link from "next/link";
import type { AgreementDetail, MemberRole } from "@/application/ports";
import { canWriteRecords } from "@/components/records/state";
import { PageHeader } from "@/components/shell/page-header";
import { StatusPill } from "@/components/ui/status-pill";
import { labelFor } from "@/domain/agreement";
import { formatCadExact } from "@/lib/money";
import { LineFormControl } from "./line-form";
import { LineRow } from "./line-row";
import { ReviseControl, WithdrawControl } from "./move-controls";
import type { LineState, MoveState } from "./state";

/** The page's Server Actions, bound to this agreement (or, for line writes, to one line). */
export type AgreementActions = {
  add: (formData: FormData) => Promise<LineState>;
  update: (lineId: string) => (formData: FormData) => Promise<LineState>;
  remove: (lineId: string) => () => Promise<LineState>;
  revise: () => Promise<MoveState>;
  withdraw: () => Promise<MoveState>;
};

type AgreementViewProps = {
  agreement: AgreementDetail;
  role: MemberRole;
  /** Without actions, or for a viewer, the agreement is read-only. */
  actions?: AgreementActions;
};

/** The empty add form suggests the usual first line; a stored $0 line would look like a real price. */
const FIRST_LINE = { description: "Preventive maintenance visit", visitsPerYear: "4", costPerVisit: "" };
const NEXT_LINE = { description: "", visitsPerYear: "", costPerVisit: "" };

const date = new Intl.DateTimeFormat("en-CA", { dateStyle: "medium", timeZone: "America/Vancouver" });

const link = "inline-flex min-h-11 items-center font-medium text-action lg:min-h-0";

/** The agreement page body: who and where, the version shown, its lines and total, and the versions list. */
export function AgreementView({ agreement, role, actions }: AgreementViewProps) {
  const writer = canWriteRecords(role) ? actions : undefined;
  const { shown } = agreement;
  const latest = agreement.versions[0]?.versionNo ?? shown.versionNo;
  const label = labelFor(agreement.stage, agreement.status);
  const lineActions = writer && agreement.editable ? writer : undefined;
  const canRevise = writer && agreement.status === "changes_requested";
  const canWithdraw = writer && (agreement.status === "draft" || agreement.status === "sent");

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
      </div>

      <section aria-label="Service lines" className="overflow-hidden rounded-panel border border-hairline bg-surface">
        <h2 className="border-b border-hairline bg-ground px-4 py-2 text-[13px] font-semibold">Service lines</h2>
        {shown.lines.length === 0 ? (
          <p className="px-4 py-6 text-center text-[13px] text-ink-2">No service lines yet.</p>
        ) : (
          <ul className="divide-y divide-hairline">
            {shown.lines.map((line) => (
              <LineRow
                key={line.id}
                line={line}
                actions={lineActions && { update: lineActions.update(line.id), remove: lineActions.remove(line.id) }}
              />
            ))}
          </ul>
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
          <LineFormControl
            idPrefix="new-line"
            initial={shown.lines.length === 0 ? FIRST_LINE : NEXT_LINE}
            submitLabel="Add line"
            action={lineActions.add}
          />
        </section>
      )}

      {agreement.versions.length > 1 && (
        <section aria-label="Versions" className="flex flex-col gap-1">
          <h2 className="text-[13px] font-semibold">Versions</h2>
          <ul className="flex flex-col">
            {agreement.versions.map((version) => (
              <li key={version.versionNo} data-version={version.versionNo} className="flex flex-wrap items-center gap-2 text-[13px]">
                <Link href={`/agreements/${agreement.id}?version=${version.versionNo}`} className={link}>
                  {`Version ${version.versionNo}`}
                </Link>
                <span className="text-ink-2">{date.format(version.createdAt)}</span>
                {version.versionNo === latest && <StatusPill tone="neutral" label="Current" />}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
