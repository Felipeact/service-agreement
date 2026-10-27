import Link from "next/link";
import type { ReactNode } from "react";
import type { AgreementServiceScope } from "@/application/ports";
import type { ScopeType } from "@/domain/agreement";

type ServiceScopeSectionsProps = {
  scope: AgreementServiceScope;
  siteId: string;
  /** Writers get a way to the site when a live scope has no equipment. */
  canAddEquipment: boolean;
};

const date = new Intl.DateTimeFormat("en-CA", { dateStyle: "medium", timeZone: "America/Vancouver" });

const panel = "overflow-hidden rounded-panel border border-hairline bg-surface";
const heading = "border-b border-hairline bg-ground px-4 py-2 text-[13px] font-semibold";
const note = "px-4 py-6 text-center text-[13px] text-ink-2";

const units = (count: number) => `${count} ${count === 1 ? "unit" : "units"}`;

/** "Service included" and "Equipment": what the shown version covers, one entry per equipment type. */
export function ServiceScopeSections({ scope, siteId, canAddEquipment }: ServiceScopeSectionsProps) {
  const types: ScopeType[] = scope.source === "not_recorded" ? [] : scope.types;
  const recorded = scope.source === "frozen" && scope.takenAt ? `As recorded on ${date.format(scope.takenAt)}` : null;

  let empty: ReactNode = null;
  if (scope.source === "not_recorded") {
    empty = <p className={note}>Not recorded for this version.</p>;
  } else if (types.length === 0 && scope.source === "frozen") {
    empty = <p className={note}>No equipment was recorded for this version.</p>;
  } else if (types.length === 0) {
    empty = (
      <div className={`${note} flex flex-col items-center gap-1`}>
        <p>No equipment on this site yet.</p>
        {canAddEquipment && (
          <Link href={`/sites/${siteId}`} className="inline-flex min-h-11 items-center font-medium text-action">
            Add equipment
          </Link>
        )}
      </div>
    );
  }

  const recordedNote = recorded && <p className="border-b border-hairline px-4 py-2 text-[12px] text-ink-2">{recorded}</p>;

  return (
    <>
      <section aria-label="Service included" className={panel}>
        <h2 className={heading}>Service included</h2>
        {recordedNote}
        {empty ?? (
          <ul className="divide-y divide-hairline">
            {types.map((type) => (
              <li key={type.code} className="flex flex-col gap-1 px-4 py-3">
                <p className="text-[14px] font-medium">{`${type.name}, ${units(type.assets.length)}`}</p>
                {type.tasks.length === 0 ? (
                  <p className="text-[13px] text-ink-2">No checklist for this type yet.</p>
                ) : (
                  <ul className="list-disc pl-5 text-[13px]">
                    {type.tasks.map((task, index) => (
                      <li key={index}>{task}</li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Equipment" className={panel}>
        <h2 className={heading}>Equipment</h2>
        {recordedNote}
        {empty ?? (
          <div className="divide-y divide-hairline">
            {types.map((type) => (
              <details key={type.code} className="group">
                <summary className="flex min-h-11 cursor-pointer items-center px-4 text-[14px] font-medium">
                  {`${type.name} · ${type.assets.length}`}
                </summary>
                <div
                  data-equipment-head
                  className="hidden gap-x-3 border-t border-hairline px-4 py-2 text-[12px] font-medium text-ink-2 md:grid md:grid-cols-[8rem_minmax(0,1fr)_minmax(0,1fr)]"
                >
                  <span>Unit #</span>
                  <span>Type/model</span>
                  <span>Location</span>
                </div>
                <ul className="divide-y divide-hairline border-t border-hairline">
                  {type.assets.map((asset, index) => (
                    <li
                      key={index}
                      className="grid gap-x-3 gap-y-0.5 px-4 py-2 text-[13px] md:grid-cols-[8rem_minmax(0,1fr)_minmax(0,1fr)]"
                    >
                      <span className="font-medium">{asset.unitNo ?? "—"}</span>
                      <span className="break-words text-ink-2 md:text-ink">{asset.typeModel ?? "—"}</span>
                      <span className="break-words text-ink-2 md:text-ink">{asset.location ?? "—"}</span>
                    </li>
                  ))}
                </ul>
              </details>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
