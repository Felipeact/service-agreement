"use client";

import { useState, useTransition, type ReactNode } from "react";
import { PlusIcon } from "lucide-react";
import type { ServiceLineView } from "@/application/ports";
import type { EquipmentChoice, UncoveredType } from "@/domain/agreement";
import { FREQUENCY_MONTHS, frequencyLabel, recipeFor, suggestedCostPerVisit, DEFAULT_RATES } from "@/domain/agreement/service-plan";
import { DEFAULT_ITEM_WORDS, itemText, type ItemWords } from "@/domain/org-settings";
import type { LineState } from "@/components/agreements/state";
import { GuidedSection } from "./guided";
import { ReviewableLines } from "./review-lines";
import { field, linkButton, money, monthsText, primaryButton, secondaryButton, units } from "./styles";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

type LineAction = (formData: FormData) => Promise<LineState>;
export type LinesActions = { add: LineAction; lines: Record<string, { update: LineAction; remove: () => Promise<LineState> }> };

/** A line as the editor holds it. */
type Draft = { id: string | null; description: string; months: number[]; price: string; typeIds: string[] };

const sameMonths = (a: readonly number[], b: readonly number[]) => a.join(",") === b.join(",");
const hours = (minutes: number) => Math.round(minutes / 6) / 10;

function formOf(draft: { description: string; months: number[]; price: string; typeIds: string[] }): FormData {
  const formData = new FormData();
  formData.set("description", draft.description.trim());
  for (const month of draft.months) formData.append("visitMonths", String(month));
  formData.set("costPerVisit", draft.price);
  for (const id of draft.typeIds) formData.append("assetTypeIds", id);
  return formData;
}

const draftOf = (line: ServiceLineView): Draft => ({
  id: line.id,
  description: line.description,
  months: [...line.visitMonths],
  price: (line.costPerVisitCents / 100).toFixed(2),
  typeIds: line.equipment.map((type) => type.id),
});

/** The labour price of a visit to the given types, at the shop rate. */
function suggestion(choices: readonly EquipmentChoice[], typeIds: readonly string[]) {
  const minutes = choices.filter((choice) => typeIds.includes(choice.id)).reduce((sum, choice) => sum + (choice.units ?? 0) * recipeFor(choice).minutesPerUnit, 0);
  return { minutes, cents: suggestedCostPerVisit(minutes, DEFAULT_RATES) };
}

/** What a refused save says. */
function problemOf(state: LineState): string | null {
  if (state.status === "invalid") return Object.values(state.errors).filter(Boolean).join(" ") || "Check the line and try again.";
  if (state.status === "saved" || state.status === "idle") return null;
  if (state.status === "locked") return "This agreement can no longer be edited.";
  if (state.status === "too_many") return "An agreement can have up to 50 lines.";
  if (state.status === "forbidden") return "You cannot change this agreement.";
  return "The line could not be saved. Try again.";
}

/** The twelve month toggles a line visits in, with the frequency shortcuts. */
function MonthToggles({ months, onChange }: { months: number[]; onChange: (months: number[]) => void }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1.5 text-[13px] font-semibold">Visit months</legend>
      <div className="grid grid-cols-6 gap-1.5 xl:grid-cols-12">
        {MONTHS.map((name, index) => {
          const month = index + 1;
          const isOn = months.includes(month);
          return (
            <button
              key={name}
              type="button"
              aria-pressed={isOn}
              onClick={() => {
                const next = isOn ? months.filter((candidate) => candidate !== month) : [...months, month].sort((a, b) => a - b);
                if (next.length > 0) onChange(next);
              }}
              className={`min-h-11 rounded-control text-[13px] font-semibold lg:min-h-9 ${isOn ? "bg-action text-surface" : "border border-hairline bg-surface text-ink-2 hover:bg-board"}`}
            >
              {name}
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-2 text-[13px]">
        {(["monthly", "quarterly", "semi_annual", "annual"] as const).map((frequency) => (
          <button key={frequency} type="button" onClick={() => onChange([...FREQUENCY_MONTHS[frequency]])} className="min-h-11 rounded-full border border-hairline px-3 font-medium hover:bg-board lg:min-h-8">
            {frequencyLabel(FREQUENCY_MONTHS[frequency])}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

/** The editor of one service line, inline in its row: description, months, equipment covered and price beside the suggested one. */
function LineEditor({
  initial,
  lines,
  choices,
  words,
  onSave,
  onCancel,
}: {
  initial: Draft;
  lines: ServiceLineView[];
  choices: EquipmentChoice[];
  words: ItemWords;
  onSave: (draft: Draft) => Promise<string | null>;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  const [problem, setProblem] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const suggested = suggestion(choices, draft.typeIds);
  const isValid = draft.description.trim() !== "" && draft.typeIds.length > 0 && draft.months.length > 0;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!isValid) return;
        startTransition(async () => setProblem(await onSave(draft)));
      }}
      className="flex flex-col gap-5 bg-ground px-5 py-4"
    >
      <label className="flex flex-col gap-1 text-[13px] font-semibold">
        Description
        <input value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} maxLength={200} className={field} />
      </label>
      <MonthToggles months={draft.months} onChange={(months) => setDraft({ ...draft, months })} />
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-[13px] font-semibold">{itemText("Equipment covered", words)}</legend>
        <div className="grid gap-x-4 sm:grid-cols-2">
          {choices.map((type) => {
            const other = lines.find((line) => line.id !== draft.id && line.equipment.some((covered) => covered.id === type.id));
            const isOn = draft.typeIds.includes(type.id);
            return (
              <label key={type.id} className="flex min-h-11 items-center gap-2.5 text-[14px] lg:min-h-9">
                <input
                  type="checkbox"
                  checked={isOn}
                  onChange={() => setDraft({ ...draft, typeIds: isOn ? draft.typeIds.filter((id) => id !== type.id) : [...draft.typeIds, type.id] })}
                  className="size-4 accent-action"
                />
                <span>
                  {type.name} <span className="tabular-nums text-ink-2">{type.units ?? 0}</span>
                  {other && !isOn && <span className="text-[12px] text-ink-2"> (on {frequencyLabel(other.visitMonths).toLowerCase()} line, moves here)</span>}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <label className="flex flex-col gap-1 text-[13px] font-semibold">
          Price a visit
          <span className={`flex w-40 items-center ${field}`}>
            <span className="text-ink-2">$</span>
            <input inputMode="decimal" value={draft.price} onChange={(event) => setDraft({ ...draft, price: event.target.value })} className="h-10 w-full min-w-0 bg-transparent px-1 font-semibold tabular-nums focus:outline-none" />
          </span>
        </label>
        <p className="text-[13px] text-ink-2 sm:text-right">
          Suggested {money(suggested.cents)}: {hours(suggested.minutes)} h on site at {money(DEFAULT_RATES.hourlyRateCents)} an hour.{" "}
          <button type="button" onClick={() => setDraft({ ...draft, price: (suggested.cents / 100).toFixed(2) })} className="min-h-11 font-semibold text-action hover:underline lg:min-h-0">
            Use it
          </button>
        </p>
      </div>
      {!isValid && <p className="text-[13px] font-medium text-danger">{itemText("A line needs a description, at least one month and at least one piece of equipment.", words)}</p>}
      {problem && (
        <p role="alert" className="text-[13px] font-medium text-danger">
          {itemText(problem, words)}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={!isValid || isPending} className={primaryButton}>
          {isPending ? "Saving…" : "Save line"}
        </button>
        <button type="button" onClick={onCancel} disabled={isPending} className={secondaryButton}>
          Cancel
        </button>
      </div>
    </form>
  );
}

/**
 * The Service lines and prices section (approved design): the lines with their visits and money, edited in place (a type moves
 * off any other line when checked here, and a line left with none goes), removed after a Keep/Remove confirm, a new line from
 * "Add a line", and equipment no line covers offered to the line visiting in its usual months or a new one. The AI review's
 * suggestion replaces the rows while it is open.
 */
export function LinesSection({
  section,
  lines,
  choices,
  uncovered,
  totalCents,
  actions,
  words = DEFAULT_ITEM_WORDS,
  extra,
}: {
  section: { state: string; isDone?: boolean };
  lines: ServiceLineView[];
  choices: EquipmentChoice[];
  uncovered: UncoveredType[];
  totalCents: number;
  /** Absent for a reader or a version that cannot change. */
  actions?: LinesActions;
  words?: ItemWords;
  /** Shown under the rows, such as "Build service lines" for a draft with none. */
  extra?: ReactNode;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const unitsOf = (line: ServiceLineView) => line.equipment.reduce((sum, type) => sum + (choices.find((choice) => choice.id === type.id)?.units ?? 0), 0);

  /** Saves the edited or new line, then takes its types off any other line (removing a line left with none). */
  async function handleSave(draft: Draft): Promise<string | null> {
    if (!actions) return "You cannot change this agreement.";
    const saved = draft.id ? await actions.lines[draft.id].update(formOf(draft)) : await actions.add(formOf(draft));
    const refused = problemOf(saved);
    if (refused) return refused;
    for (const other of lines) {
      if (other.id === draft.id || !other.equipment.some((type) => draft.typeIds.includes(type.id))) continue;
      const left = other.equipment.map((type) => type.id).filter((id) => !draft.typeIds.includes(id));
      const done = left.length === 0 ? await actions.lines[other.id].remove() : await actions.lines[other.id].update(formOf({ ...draftOf(other), typeIds: left }));
      const failed = problemOf(done);
      if (failed) return failed;
    }
    setEditing(null);
    return null;
  }

  /** Puts an uncovered type on the line visiting in its usual months, or builds that line at the suggested price. */
  function handleCover(type: UncoveredType) {
    const choice = choices.find((candidate) => candidate.code === type.code);
    if (!actions || !choice) return;
    const months = recipeFor(choice).months;
    const line = lines.find((candidate) => sameMonths(candidate.visitMonths, months));
    startTransition(async () => {
      const result = line
        ? await actions.lines[line.id].update(formOf({ ...draftOf(line), typeIds: [...line.equipment.map((covered) => covered.id), choice.id] }))
        : await actions.add(
            formOf({ description: `${frequencyLabel(months)} preventive maintenance`, months, price: (suggestion(choices, [choice.id]).cents / 100).toFixed(2), typeIds: [choice.id] }),
          );
      setProblem(problemOf(result));
    });
  }

  function handleRemove(lineId: string) {
    if (!actions) return;
    startTransition(async () => {
      const result = await actions.lines[lineId].remove();
      setProblem(problemOf(result));
      setRemoving(null);
    });
  }

  const blank: Draft = { id: null, description: "", months: [...FREQUENCY_MONTHS.quarterly], price: "", typeIds: [] };

  return (
    <GuidedSection
      id="lines"
      label="Service lines"
      title="Service lines and prices"
      state={section.state}
      isDone={section.isDone}
      action={
        actions &&
        choices.length > 0 && (
          <button type="button" onClick={() => setEditing("new")} className={linkButton}>
            <PlusIcon className="mr-1 size-4" aria-hidden="true" /> Add a line
          </button>
        )
      }
    >
      {actions && uncovered.length > 0 && (
        <ul className="flex flex-col gap-2 border-b border-amber-200 bg-amber-50 px-5 py-3">
          {uncovered.map((type) => {
            const choice = choices.find((candidate) => candidate.code === type.code);
            const months = choice ? recipeFor(choice).months : [];
            const line = lines.find((candidate) => sameMonths(candidate.visitMonths, months));
            return (
              <li key={type.code} className="flex flex-wrap items-center justify-between gap-2 text-[14px]">
                <span>
                  <span className="font-semibold">{type.name}</span>, {units(type.assetCount)}, is not on any line.
                </span>
                {choice && (
                  <button type="button" onClick={() => handleCover(type)} disabled={isPending} className={secondaryButton}>
                    {line ? `Add to the ${frequencyLabel(months).toLowerCase()} line` : `Build a ${frequencyLabel(months).toLowerCase()} line`}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {problem && (
        <p role="alert" className="border-b border-hairline px-5 py-2 text-[13px] font-medium text-danger">
          {itemText(problem, words)}
        </p>
      )}
      <ReviewableLines
        bare
        footer={
          <div className="flex items-baseline justify-between border-t border-hairline px-5 py-3">
            <p className="text-[14px] font-semibold">Total a year</p>
            <p className="text-right">
              <span className="text-[17px] font-extrabold tabular-nums">{money(totalCents)}</span>
              <span className="block text-[12px] text-ink-2">Before tax</span>
            </p>
          </div>
        }
      >
        <div className="hidden grid-cols-[minmax(0,1fr)_9rem_6.5rem_6.5rem_5.5rem] gap-x-3 border-b border-hairline px-5 py-2 text-[12px] font-medium text-ink-2 md:grid">
          <span>Service line</span>
          <span>Visits</span>
          <span className="text-right">A visit</span>
          <span className="text-right">A year</span>
          <span className="sr-only">Actions</span>
        </div>
        {lines.length === 0 && editing !== "new" && <p className="px-5 py-6 text-center text-[13px] text-ink-2">No service lines yet.</p>}
        <ul className="divide-y divide-hairline">
          {lines.map((line) =>
            editing === line.id ? (
              <li key={line.id}>
                <LineEditor initial={draftOf(line)} lines={lines} choices={choices} words={words} onSave={handleSave} onCancel={() => setEditing(null)} />
              </li>
            ) : (
              <li key={line.id} className="grid grid-cols-2 items-center gap-x-3 gap-y-1 px-5 py-3 text-[14px] md:grid-cols-[minmax(0,1fr)_9rem_6.5rem_6.5rem_5.5rem]">
                <span className="col-span-2 flex min-w-0 flex-col md:col-span-1">
                  <span className="font-semibold break-words">{line.description}</span>
                  <span className="text-[12px] text-ink-2">{line.equipment.map((type) => type.name).join(", ")}</span>
                </span>
                <span className="col-span-2 text-ink-nav md:col-span-1">
                  {monthsText(line.visitMonths)}
                  <span className="block text-[12px] text-ink-2">
                    {line.visitsPerYear} a year, {units(unitsOf(line))}
                  </span>
                </span>
                <span className={`tabular-nums md:text-right ${line.costPerVisitCents <= 0 ? "font-semibold text-amber-700" : ""}`}>
                  {money(line.costPerVisitCents)}
                  <span className="font-normal text-ink-2 md:hidden"> a visit</span>
                </span>
                <span className="text-right font-semibold tabular-nums">
                  {money(line.annualCents)}
                  <span className="font-normal text-ink-2 md:hidden"> a year</span>
                </span>
                {actions ? (
                  <span className="col-span-2 flex justify-end gap-1 md:col-span-1">
                    {removing === line.id ? (
                      <>
                        <button
                          type="button"
                          onClick={() => handleRemove(line.id)}
                          disabled={isPending}
                          className="inline-flex min-h-11 items-center rounded-control px-2 text-[13px] font-semibold text-danger hover:bg-danger-tint lg:min-h-8"
                        >
                          Remove
                        </button>
                        <button type="button" onClick={() => setRemoving(null)} className="inline-flex min-h-11 items-center rounded-control px-2 text-[13px] font-semibold hover:bg-board lg:min-h-8">
                          Keep
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => setEditing(line.id)}
                          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-control px-2 text-[13px] font-semibold text-action hover:bg-board lg:min-h-8 lg:min-w-0"
                        >
                          Edit
                        </button>
                        <button type="button" onClick={() => setRemoving(line.id)} className="inline-flex min-h-11 items-center rounded-control px-2 text-[13px] font-semibold text-ink-2 hover:bg-board lg:min-h-8">
                          Remove
                        </button>
                      </>
                    )}
                  </span>
                ) : (
                  <span className="hidden md:block" />
                )}
              </li>
            ),
          )}
          {editing === "new" && (
            <li>
              <LineEditor initial={blank} lines={lines} choices={choices} words={words} onSave={handleSave} onCancel={() => setEditing(null)} />
            </li>
          )}
        </ul>
        {extra}
      </ReviewableLines>
    </GuidedSection>
  );
}
