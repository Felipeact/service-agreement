"use client";

import { useReducer, useRef, useState, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { MonthGrid } from "@/components/ui/month-grid";
import { TextInput } from "@/components/ui/text-input";
import {
  DRAFT_ERROR_MESSAGES,
  draftTypeErrors,
  type DraftErrorCode,
  type DraftType,
} from "@/domain/task-library/draft";
import { draftReducer, type AddTypesAnswer } from "./draft-state";

export type DraftPanelProps = {
  /** `addCatalogTypesAction`: the one write, after the owner has reviewed the draft. */
  addTypes: (types: DraftType[]) => Promise<AddTypesAnswer>;
  /** Told the names that were added, so the catalog review can show them. */
  onAdded?: (names: string[]) => void;
  /** Where the panel starts; only a test passes these. */
  initialTypes?: DraftType[];
  initialPending?: boolean;
  initialError?: { code: DraftErrorCode; message?: string };
  initialDescription?: string;
  initialFileName?: string;
};

const CARD = "flex flex-col gap-4 rounded-panel border border-hairline bg-surface p-5 shadow-card sm:p-6";
const FIELD = "w-full rounded-control border bg-surface px-3 text-[13px] text-ink border-field";

/** The panel sits inside the profile form, so Enter in a field here must not submit it. */
const keepForm = (event: KeyboardEvent) => {
  if (event.key === "Enter") event.preventDefault();
};

const isCode = (value: unknown): value is DraftErrorCode => typeof value === "string" && value in DRAFT_ERROR_MESSAGES;

function addMessage(answer: Exclude<AddTypesAnswer, { ok: true }>): string {
  if (answer.code === "forbidden") return DRAFT_ERROR_MESSAGES.forbidden;
  if (answer.code === "duplicate") return `${answer.name ? `A type named "${answer.name}"` : "A type in this draft"} already exists in your catalog. Rename or remove it, then add again.`;
  if (answer.code === "invalid") return "Check the types for errors and try again.";
  return "We couldn't add your types. Try again.";
}

/** Draft a catalog from a description or a proposal, review it, and add it (other-trade-draft). Nothing is stored until the add. */
export function DraftPanel({ addTypes, onAdded, initialTypes, initialPending = false, initialError, initialDescription = "", initialFileName = "" }: DraftPanelProps) {
  const [types, dispatch] = useReducer(draftReducer, initialTypes ?? []);
  const [showing, setShowing] = useState(initialTypes !== undefined && initialTypes.length > 0);
  const [description, setDescription] = useState(initialDescription);
  const [fileName, setFileName] = useState(initialFileName);
  const file = useRef<File | null>(null);
  const [drafting, setDrafting] = useState(initialPending);
  const [error, setError] = useState<{ code: DraftErrorCode; message?: string } | null>(initialError ?? null);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [addedCount, setAddedCount] = useState(0);

  async function draft() {
    setDrafting(true);
    setError(null);
    setAddedCount(0);
    const form = new FormData();
    if (description.trim()) form.set("description", description);
    if (file.current) form.set("file", file.current);
    try {
      const response = await fetch("/api/setup/draft", { method: "POST", body: form });
      const body: unknown = await response.json().catch(() => null);
      const answer = (body ?? {}) as { types?: DraftType[]; error?: unknown; message?: unknown };
      if (response.ok && Array.isArray(answer.types)) {
        dispatch({ type: "set", types: answer.types });
        setShowing(true);
      } else {
        setError({ code: isCode(answer.error) ? answer.error : "unavailable", ...(typeof answer.message === "string" && { message: answer.message }) });
      }
    } catch {
      setError({ code: "unavailable" });
    } finally {
      setDrafting(false);
    }
  }

  async function add() {
    setAdding(true);
    setAddError(null);
    try {
      const answer = await addTypes(types);
      if (answer.ok) {
        dispatch({ type: "set", types: [] });
        setShowing(false);
        setAddedCount(answer.added.length);
        onAdded?.(answer.added);
      } else {
        setAddError(addMessage(answer));
      }
    } catch {
      setAddError(addMessage({ ok: false, code: "unavailable" }));
    } finally {
      setAdding(false);
    }
  }

  const errors = types.map(draftTypeErrors);
  const blocked = errors.some((e) => Object.keys(e).length > 0);

  return (
    <section aria-labelledby="draft-title" className={CARD}>
      <div className="flex flex-col gap-1">
        <h2 id="draft-title" className="font-display text-[18px] font-semibold tracking-tight">
          Draft your catalog
        </h2>
        <p className="text-[13px] text-ink-2">
          Tell us what you service, or upload your current proposal, and we&rsquo;ll draft the types, checklists and visit months for you to review.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="draft-description" className="text-[13px] font-medium text-ink">
          Describe your trade
        </label>
        <textarea
          id="draft-description"
          rows={4}
          maxLength={1000}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          className={`${FIELD} py-2`}
        />
        <p className="text-[12px] text-ink-2">Up to 1,000 characters</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="draft-file" className="text-[13px] font-medium text-ink">
          Or upload your current proposal
        </label>
        <input
          id="draft-file"
          type="file"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={(event) => {
            file.current = event.target.files?.[0] ?? null;
            setFileName(file.current?.name ?? "");
          }}
          className="min-h-11 w-full text-[13px] text-ink"
        />
        <p className="text-[12px] text-ink-2">PDF or Word, up to 5 MB{fileName ? ` · Chosen: ${fileName}` : ""}</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button variant="primary" onClick={draft} disabled={drafting}>
          {drafting ? "Drafting, this can take up to a minute" : "Draft my catalog"}
        </Button>
        {error && (
          <p role="alert" className="text-[13px] font-medium text-danger">
            {error.message ?? DRAFT_ERROR_MESSAGES[error.code]}
          </p>
        )}
        {addedCount > 0 && (
          <p role="status" className="text-[13px] font-medium text-ink">
            Added {addedCount} {addedCount === 1 ? "type" : "types"} to your catalog.
          </p>
        )}
      </div>

      {showing && (
        <div className="flex flex-col gap-4">
          <p className="text-[13px] text-ink-2">
            This draft was written by AI. You own your checklists: check each one against your own procedures and any code or regulation that applies before you use it.
          </p>
          <p className="text-[13px] font-medium text-ink">Nothing is added until you press Add to my catalog.</p>
          {types.map((type, index) => (
            <div key={index} className="flex flex-col gap-3 rounded-control border border-hairline bg-board p-4">
              <TextInput
                id={`draft-name-${index}`}
                label="Type name"
                value={type.name}
                onChange={(event) => dispatch({ type: "rename", index, name: event.target.value })}
                onKeyDown={keepForm}
                error={errors[index].name}
              />
              <MonthGrid
                name={`draft-months-${index}`}
                legend="Default visit months"
                checked={type.defaultVisitMonths}
                onToggle={(month) => dispatch({ type: "toggleMonth", index, month })}
                presets={false}
                error={errors[index].months}
                errorId={`draft-months-${index}-error`}
              />
              <TextInput
                id={`draft-synonyms-${index}`}
                label="Other spellings, separated by commas"
                value={type.synonyms.join(", ")}
                onChange={(event) => dispatch({ type: "setSynonyms", index, raw: event.target.value })}
                onKeyDown={keepForm}
              />
              <div className="flex flex-col gap-2">
                <p className="text-[13px] font-medium text-ink">Checklist</p>
                {type.tasks.map((task, taskIndex) => (
                  <div key={taskIndex} className="flex items-end gap-2">
                    <TextInput
                      id={`draft-task-${index}-${taskIndex}`}
                      label={`Task ${taskIndex + 1}`}
                      className="min-w-0 flex-1"
                      value={task.description}
                      onChange={(event) => dispatch({ type: "editTask", index, task: taskIndex, text: event.target.value })}
                      onKeyDown={keepForm}
                    />
                    <Button aria-label={`Remove task ${taskIndex + 1} of ${type.name || "this type"}`} onClick={() => dispatch({ type: "removeTask", index, task: taskIndex })}>
                      Remove
                    </Button>
                  </div>
                ))}
                {errors[index].tasks && <p className="text-[12px] font-medium text-danger">{errors[index].tasks}</p>}
              </div>
              <div>
                <Button variant="secondary" onClick={() => dispatch({ type: "removeType", index })}>
                  Remove type
                </Button>
              </div>
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary" onClick={add} disabled={blocked || adding || types.length === 0}>
              Add to my catalog
            </Button>
            {addError && (
              <p role="alert" className="text-[13px] font-medium text-danger">
                {addError}
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
