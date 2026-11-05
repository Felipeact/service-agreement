"use client";

import { useActionState, useState } from "react";
import { MONTH_PRESETS, monthRunsLabel, type MonthPreset } from "@/domain/agreement";
import { MAX_LIBRARY_TASKS, MAX_TASK_DESCRIPTION, type LibraryType } from "@/domain/task-library";
import { Button } from "@/components/ui/button";
import { MonthGrid, monthBox, monthChoice } from "@/components/ui/month-grid";
import { TextInput } from "@/components/ui/text-input";
import { TASK_LIBRARY_STATUS_MESSAGES, type TaskLibraryFormState } from "./state";

type Row = { key: number; description: string; months: number[] };

type EditorProps = {
  type: LibraryType;
  action: (state: TaskLibraryFormState, formData: FormData) => Promise<TaskLibraryFormState>;
};

const toggled = (months: number[], month: number) =>
  (months.includes(month) ? months.filter((m) => m !== month) : [...months, month]).sort((a, b) => a - b);

/** One type's default months and checklist as a form; nothing is stored until Save (task-library-page S2, S3). */
export function TaskLibraryEditor({ type, action }: EditorProps) {
  const [state, formAction, pending] = useActionState(action, { status: "idle" } as TaskLibraryFormState);
  const [defaults, setDefaults] = useState<number[]>(type.defaultVisitMonths);
  const [rows, setRows] = useState<Row[]>(() => type.tasks.map((task, key) => ({ key, description: task.description, months: task.visitMonths ?? [] })));
  const [nextKey, setNextKey] = useState(type.tasks.length);

  const update = (key: number, patch: Partial<Row>) => setRows((all) => all.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  const move = (index: number, by: -1 | 1) =>
    setRows((all) => {
      const copy = [...all];
      [copy[index], copy[index + by]] = [copy[index + by], copy[index]];
      return copy;
    });
  const errors = state.status === "invalid" ? state.errors : {};
  const message = state.status === "idle" || state.status === "invalid" ? null : TASK_LIBRARY_STATUS_MESSAGES[state.status];

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="typeCode" value={type.code} />

      <MonthGrid
        name="defaultVisitMonths"
        legend="Default visit months"
        checked={defaults}
        onToggle={(month) => setDefaults((months) => toggled(months, month))}
        onPreset={(preset: MonthPreset) => setDefaults([...MONTH_PRESETS[preset]])}
        error={errors.defaultVisitMonths}
        errorId="defaultVisitMonths-error"
      />

      <section className="flex flex-col gap-3" aria-label="Checklist">
        <h2 className="text-[15px] font-semibold">Checklist</h2>
        {errors.tasks && <p className="text-[12px] font-medium text-danger">{errors.tasks}</p>}
        <ol className="flex flex-col gap-3">
          {rows.map((row, index) => {
            const rowErrors = errors.rows?.[index];
            const allVisits = row.months.length === 0;
            return (
              <li key={row.key} className="flex flex-col gap-3 rounded-panel border border-hairline bg-surface p-3">
                <TextInput
                  id={`task-${index}-description`}
                  name="taskDescription"
                  label={`Task ${index + 1}`}
                  value={row.description}
                  onChange={(event) => update(row.key, { description: event.target.value })}
                  error={rowErrors?.description}
                  maxLength={MAX_TASK_DESCRIPTION}
                />
                <label className={`${monthChoice} self-start px-3`}>
                  <input
                    type="checkbox"
                    checked={allVisits}
                    onChange={() => update(row.key, { months: allVisits ? (defaults.length > 0 ? defaults : type.defaultVisitMonths) : [] })}
                    className={monthBox}
                  />
                  All visits
                </label>
                {!allVisits && <p className="text-[13px] text-ink-2">{monthRunsLabel(row.months)}</p>}
                <MonthGrid
                  name={`taskMonths-${index}`}
                  legend="Visit months"
                  checked={row.months}
                  presets={false}
                  onToggle={(month) => update(row.key, { months: toggled(row.months, month) })}
                  error={rowErrors?.visitMonths}
                  errorId={`task-${index}-months-error`}
                />
                <div className="flex flex-wrap gap-1.5">
                  <Button aria-label={`Move task ${index + 1} up`} disabled={index === 0} onClick={() => move(index, -1)}>
                    Move up
                  </Button>
                  <Button aria-label={`Move task ${index + 1} down`} disabled={index === rows.length - 1} onClick={() => move(index, 1)}>
                    Move down
                  </Button>
                  <Button aria-label={`Remove task ${index + 1}`} variant="danger" onClick={() => setRows((all) => all.filter((r) => r.key !== row.key))}>
                    Remove
                  </Button>
                </div>
              </li>
            );
          })}
        </ol>
        <div>
          <Button
            disabled={rows.length >= MAX_LIBRARY_TASKS}
            onClick={() => {
              setRows((all) => [...all, { key: nextKey, description: "", months: [] }]);
              setNextKey((key) => key + 1);
            }}
          >
            Add task
          </Button>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="primary" disabled={pending}>
          Save changes
        </Button>
      </div>
      {state.status === "invalid" && (
        <p role="alert" className="text-[13px] font-medium text-danger">
          Fix the highlighted fields and save again.
        </p>
      )}
      {message && (
        <p role={state.status === "saved" ? "status" : "alert"} className={`text-[13px] font-medium ${state.status === "saved" ? "text-ink" : "text-danger"}`}>
          {message}
        </p>
      )}
    </form>
  );
}
