import Link from "next/link";
import type { ReactNode } from "react";
import type { AgreementServiceScope } from "@/application/ports";
import { DEFAULT_ITEM_WORDS, itemWas, type ItemWords } from "@/domain/org-settings";
import { isUnreached, taskLabel, type ScheduleLine, type ScopeType } from "@/domain/agreement";
import { detailText, unitCount, unitDetails } from "@/domain/agreement/unit-details";

type ServiceScopeSectionsProps = {
  scope: AgreementServiceScope;
  siteId: string;
  /** Writers get a way to the site when a live scope has no equipment. */
  canAddEquipment: boolean;
  /** A draft whose site has equipment but whose lines cover none of it: says so instead of "no equipment on this site" (p0-launch-fixes AC 10). */
  noLinesYet?: boolean;
  /** The shown version's lines, on the staff page only: a seasonal task none of them visits is flagged (seasonal-tasks AC 14). */
  lines?: readonly ScheduleLine[];
  /** The org's item words; the default when a caller has none (item-vocabulary AC 5). */
  words?: ItemWords;
};

/** What a layout section changes in the panel it draws (block-editor AC 16, 17): its title and, for the included panel, the type headings. */
type SectionLook = { title?: string; showFrequency?: boolean; uppercase?: boolean; frequencies?: Record<string, string> };

const date = new Intl.DateTimeFormat("en-CA", { dateStyle: "medium", timeZone: "America/Vancouver" });

const panel = "overflow-hidden rounded-panel border border-hairline bg-surface shadow-card";
const heading = "border-b border-hairline px-4 py-3 text-[15px] font-semibold tracking-tight";
const note = "px-4 py-6 text-center text-[13px] text-ink-2";

const units = (count: number) => `${count} ${count === 1 ? "unit" : "units"}`;

/** The types, the empty-state note and the recorded-on note both panels share. */
function scopeParts({ scope, siteId, canAddEquipment, noLinesYet = false, words = DEFAULT_ITEM_WORDS }: ServiceScopeSectionsProps) {
  const types: ScopeType[] = scope.source === "not_recorded" ? [] : scope.types;
  const recorded = scope.source === "frozen" && scope.takenAt ? `As recorded on ${date.format(scope.takenAt)}` : null;

  let empty: ReactNode = null;
  if (scope.source === "not_recorded") {
    empty = <p className={note}>Not recorded for this version.</p>;
  } else if (types.length === 0 && scope.source === "frozen") {
    empty = <p className={note}>{`No ${words.plural} ${itemWas(words)} recorded for this version.`}</p>;
  } else if (types.length === 0 && noLinesYet) {
    empty = <p className={note}>{`No ${words.plural} ${itemWas(words) === "was" ? "is" : "are"} covered until you add a service line.`}</p>;
  } else if (types.length === 0) {
    empty = (
      <div className={`${note} flex flex-col items-center gap-1`}>
        <p>{`No ${words.plural} on this site yet.`}</p>
        {canAddEquipment && (
          <Link href={`/sites/${siteId}`} className="inline-flex min-h-11 items-center font-medium text-action">
            {`Add ${words.plural}`}
          </Link>
        )}
      </div>
    );
  }

  const recordedNote = recorded && <p className="border-b border-hairline px-4 py-2 text-[12px] text-ink-2">{recorded}</p>;
  return { types, empty, recordedNote, words };
}

/** "Service included" (or the layout's title): what the shown version covers, one entry per type, as `AHU (QUARTERLY)` when the layout asks for the frequency. */
export function ServiceIncludedSection(props: ServiceScopeSectionsProps & SectionLook) {
  const { types, empty, recordedNote } = scopeParts(props);
  const { lines, title = "Service included", showFrequency = false, uppercase = false, frequencies = {} } = props;
  const headingText = (type: ScopeType) => {
    const text = showFrequency ? `${type.name}${frequencies[type.code] ? ` (${frequencies[type.code]})` : ""}` : `${type.name}, ${units(type.assets.length)}`;
    return uppercase ? text.toUpperCase() : text;
  };
  return (
    <section aria-label={title} className={panel}>
      <h2 className={heading}>{title}</h2>
      {recordedNote}
      {empty ?? (
        <ul className="divide-y divide-hairline">
          {types.map((type) => (
            <li key={type.code} className="flex flex-col gap-1 px-4 py-3">
              <p className="text-[14px] font-medium">{headingText(type)}</p>
              {type.tasks.length === 0 ? (
                <p className="text-[13px] text-ink-2">No checklist for this type yet.</p>
              ) : (
                <ul className="list-disc pl-5 text-[13px]">
                  {type.tasks.map((task, index) => (
                    <li key={index}>
                      {taskLabel(task)}
                      {lines && isUnreached(task, type.code, lines) && (
                        <span className="ml-2 rounded-sm bg-attention-bg px-1.5 py-0.5 text-[12px] font-medium text-attention-fg">No visit in these months</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * The item panel ("Equipment" by default, or the layout's title): one row per type with its unit count, and under it only what a
 * customer can read about the units (tags, models, locations, grouped). Bare unit numbers are counted, never listed.
 */
export function ServiceEquipmentSection(props: ServiceScopeSectionsProps & Pick<SectionLook, "title">) {
  const { types, empty, recordedNote, words } = scopeParts(props);
  const title = props.title ?? words.Plural;
  return (
    <section aria-label={title} className={panel}>
      <h2 className={heading}>{title}</h2>
      {recordedNote}
      {empty ?? (
        <ul className="divide-y divide-hairline">
          {types.map((type) => {
            const details = unitDetails(type.assets);
            return (
              <li key={type.code} className="flex flex-col gap-1 px-4 py-3">
                <p className="flex flex-wrap items-baseline justify-between gap-x-3 text-[14px]">
                  <span className="font-medium">{type.name}</span>
                  <span className="tabular-nums text-ink-2">{unitCount(type.assets.length)}</span>
                </p>
                {details.length > 0 && (
                  <ul className="flex flex-col gap-0.5 text-[13px] text-ink-2">
                    {details.map((detail) => (
                      <li key={detail.label} className="break-words">
                        {detailText(detail)}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** "Service included" and the item panel ("Equipment" by default): what the shown version covers, one entry per type. */
export function ServiceScopeSections(props: ServiceScopeSectionsProps) {
  return (
    <>
      <ServiceIncludedSection {...props} />
      <ServiceEquipmentSection {...props} />
    </>
  );
}
