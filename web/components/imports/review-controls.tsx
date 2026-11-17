"use client";

import { useActionState, useState, useTransition } from "react";
import type { AssetTypeOption } from "@/application/ports";
import { useItemWords } from "@/components/shell/item-words";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { TextInput } from "@/components/ui/text-input";
import { fixLine } from "@/domain/imports";
import { itemText } from "@/domain/org-settings";
import { REVIEW_MESSAGES, type CommitState, type MapState, type RowState, type SuggestState } from "./state";

function Alert({ message }: { message: string | null }) {
  const words = useItemWords();
  if (!message) return null;
  return (
    <p role="alert" className="text-[13px] font-medium text-danger">
      {itemText(message, words)}
    </p>
  );
}

const FAILURES = ["locked", "forbidden", "not_found"] as const;

/** The alert for a row or mapping answer, or `null` when it needs none. */
export function rowMessage(state: RowState | MapState): string | null {
  if (state.status === "unavailable") return REVIEW_MESSAGES.row_unavailable;
  if (state.status === "invalid" && !("errors" in state)) return REVIEW_MESSAGES.invalid;
  return (FAILURES as readonly string[]).includes(state.status) ? REVIEW_MESSAGES[state.status as (typeof FAILURES)[number]] : null;
}

/** The alert for a commit answer, or `null` when it needs none. */
export function commitMessage(state: CommitState): string | null {
  if (state.status === "unavailable") return REVIEW_MESSAGES.commit_unavailable;
  if (state.status === "incomplete") return fixLine(state.count);
  if (state.status === "nothing_to_add" || state.status === "not_ready") return REVIEW_MESSAGES[state.status];
  return (FAILURES as readonly string[]).includes(state.status) ? REVIEW_MESSAGES[state.status as (typeof FAILURES)[number]] : null;
}

export type EditableRow = { id: string; assetTypeId: string | null; unitNo: string | null; typeModel: string | null; location: string | null };

type RowEditorProps = {
  row: EditableRow;
  /** The org's asset types, ordered by name. */
  types: AssetTypeOption[];
  state: RowState;
  pending: boolean;
  onCancel?: () => void;
  action?: (formData: FormData) => void;
};

/** One row's fields as the asset form has them, with Save and Cancel. */
export function RowEditor({ row, types, state, pending, onCancel, action }: RowEditorProps) {
  const words = useItemWords();
  const errors = state.status === "invalid" && "errors" in state ? state.errors : {};
  const id = (field: string) => `${row.id}-${field}`;
  return (
    <form action={action} className="flex flex-col gap-3 rounded-control border border-hairline bg-ground p-3">
      <div className="grid gap-3 md:grid-cols-2">
        <Select id={id("assetTypeId")} name="assetTypeId" label={itemText("Equipment type", words)} defaultValue={row.assetTypeId ?? ""} error={errors.assetTypeId && itemText(errors.assetTypeId, words)}>
          <option value="">Choose a type</option>
          {types.map((type) => (
            <option key={type.id} value={type.id}>
              {`${type.name} (${type.code})`}
            </option>
          ))}
        </Select>
        <TextInput id={id("unitNo")} name="unitNo" label="Unit #" defaultValue={row.unitNo ?? ""} error={errors.unitNo} />
        <TextInput id={id("typeModel")} name="typeModel" label="Type/model" defaultValue={row.typeModel ?? ""} error={errors.typeModel} />
        <TextInput id={id("location")} name="location" label="Location/access" defaultValue={row.location ?? ""} error={errors.location} />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
        <Button onClick={onCancel}>Cancel</Button>
      </div>
      <Alert message={rowMessage(state)} />
    </form>
  );
}

type RowControlsProps = {
  row: EditableRow & { skipped: boolean };
  types: AssetTypeOption[];
  update: (formData: FormData) => Promise<RowState>;
  /** Skips an included row, or includes a skipped one. */
  toggleSkip: () => Promise<RowState>;
};

/** "Edit" opens the row's form; "Skip" / "Include" flips whether it is added. */
export function RowControls({ row, types, update, toggleSkip }: RowControlsProps) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, pending] = useActionState<RowState, FormData>(async (_, formData) => {
    const answer = await update(formData);
    if (answer.status === "saved") setEditing(false);
    return answer;
  }, { status: "idle" });
  const [skipState, skipAction, skipping] = useActionState<RowState>(() => toggleSkip(), { status: "idle" });

  if (editing) return <RowEditor row={row} types={types} state={state} pending={pending} onCancel={() => setEditing(false)} action={formAction} />;
  return (
    <div className="flex flex-col gap-2">
      <form action={skipAction} className="flex flex-wrap items-center gap-2">
        {!row.skipped && <Button onClick={() => setEditing(true)}>Edit</Button>}
        <Button type="submit" disabled={skipping}>
          {row.skipped ? "Include" : "Skip"}
        </Button>
      </form>
      <Alert message={rowMessage(skipState) ?? rowMessage(state)} />
    </div>
  );
}

type MapPromptProps = {
  spelling: { raw: string; count: number };
  types: AssetTypeOption[];
  state: MapState;
  pending: boolean;
  /** Distinguishes the select's id when several spellings show. */
  index: number;
  action?: (formData: FormData) => void;
  /** The model's suggestion for this spelling: the type it chose is preselected and says how sure the model was. */
  suggestion?: { typeId: string; confidence: "low" | "medium" | "high" };
};

const CONFIDENCE_WORDS = { high: "high confidence", medium: "medium confidence", low: "low confidence, check it" } as const;

/** One unrecognised spelling, how many rows say it, and the type to give them all. */
export function MapPrompt({ spelling, types, state, pending, index, action, suggestion }: MapPromptProps) {
  const suggested = suggestion ? types.find((type) => type.id === suggestion.typeId) : undefined;
  return (
    <form action={action} className="flex flex-col gap-2 md:flex-row md:items-end md:gap-3">
      <input type="hidden" name="rawText" value={spelling.raw} />
      <div className="flex flex-col gap-1 md:w-80">
      <Select
        key={suggested?.id ?? "none"}
        id={`map-${index}`}
        name="assetTypeId"
        label={`${spelling.raw} · ${spelling.count} ${spelling.count === 1 ? "row" : "rows"}`}
        defaultValue={suggested?.id ?? ""}
      >
        <option value="">Choose a type</option>
        {types.map((type) => (
          <option key={type.id} value={type.id}>
            {`${type.name} (${type.code})`}
          </option>
        ))}
      </Select>
      {suggested && suggestion && <p data-suggestion="" className="text-[12px] text-ink-2">{`Suggested: ${suggested.name} (${CONFIDENCE_WORDS[suggestion.confidence]})`}</p>}
      </div>
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Applying…" : "Apply"}
        </Button>
      </div>
      {state.status === "mapped" && (
        <p role="status" className="text-[13px] text-ink">{`Applied to ${state.rows} ${state.rows === 1 ? "row" : "rows"}`}</p>
      )}
      <Alert message={rowMessage(state)} />
    </form>
  );
}

type MapControlProps = Omit<MapPromptProps, "state" | "pending" | "action"> & {
  map: (formData: FormData) => Promise<MapState>;
  onMapped?: (rows: number) => void;
};

export function MapControl({ spelling, types, index, map, onMapped, suggestion }: MapControlProps) {
  const [state, formAction, pending] = useActionState<MapState, FormData>(async (_, formData) => {
    const answer = await map(formData);
    if (answer.status === "mapped") onMapped?.(answer.rows);
    return answer;
  }, { status: "idle" });
  return <MapPrompt spelling={spelling} types={types} state={state} pending={pending} index={index} action={formAction} suggestion={suggestion} />;
}

type MappingSectionProps = {
  spellings: { key: string; raw: string; count: number }[];
  types: AssetTypeOption[];
  map: (formData: FormData) => Promise<MapState>;
  /** Asks the model for a type for each spelling; absent where nothing can be asked (a viewer). */
  suggest?: () => Promise<SuggestState>;
};

const SUGGEST_MESSAGES = {
  none: "No type fits any of these. Choose one yourself.",
  unavailable: "We couldn't get suggestions. Try again, or choose the types yourself.",
} as const;

/**
 * The unrecognised spellings. It stays mounted when the last one is mapped, so "Applied to n rows" survives the
 * refresh that removes the spelling it was applied to.
 */
export function MappingSection({ spellings, types, map, suggest }: MappingSectionProps) {
  const words = useItemWords();
  const [applied, setApplied] = useState<number | null>(null);
  const [suggestions, setSuggestions] = useState<Record<string, { typeId: string; confidence: "low" | "medium" | "high" }>>({});
  const [note, setNote] = useState<string | null>(null);
  const [asking, startAsking] = useTransition();
  const [applyingAll, startApplyingAll] = useTransition();
  if (spellings.length === 0 && applied === null) return null;
  const suggested = spellings.filter((spelling) => suggestions[spelling.key]);

  function ask() {
    setNote(null);
    startAsking(async () => {
      const answer = await suggest?.();
      if (!answer) return;
      if (answer.status === "suggested") {
        setSuggestions(Object.fromEntries(answer.suggestions.map(({ key, typeId, confidence }) => [key, { typeId, confidence }])));
      } else {
        setSuggestions({});
        setNote(answer.status === "none" ? SUGGEST_MESSAGES.none : SUGGEST_MESSAGES.unavailable);
      }
    });
  }

  /** One spelling after another, so each is its own checked, saved mapping; a refusal stops at that spelling and says so. */
  function applyAll() {
    startApplyingAll(async () => {
      let rows = 0;
      for (const spelling of suggested) {
        const formData = new FormData();
        formData.set("rawText", spelling.raw);
        formData.set("assetTypeId", suggestions[spelling.key].typeId);
        const answer = await map(formData);
        if (answer.status !== "mapped") {
          setNote(rowMessage(answer) ?? SUGGEST_MESSAGES.unavailable);
          return;
        }
        rows += answer.rows;
      }
      setSuggestions({});
      setApplied(rows);
    });
  }
  return (
    <section className="flex flex-col gap-3 rounded-panel border border-hairline bg-surface px-4 py-3">
      {spellings.length > 0 && <h2 className="text-[15px] font-semibold">{itemText("Equipment types not recognised", words)}</h2>}
      {spellings.length > 0 && suggest && (
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={ask} disabled={asking || applyingAll}>
            {asking ? "Asking…" : suggested.length > 0 ? "Suggest again" : "Suggest types"}
          </Button>
          {suggested.length > 0 && (
            <Button variant="primary" onClick={applyAll} disabled={applyingAll || asking}>
              {applyingAll ? "Applying…" : `Apply all ${suggested.length} ${suggested.length === 1 ? "suggestion" : "suggestions"}`}
            </Button>
          )}
          <span className="text-[12px] text-ink-2">Suggestions are a starting point: check the ones marked low confidence.</span>
        </div>
      )}
      {note && <p role="alert" className="text-[13px] font-medium text-danger">{note}</p>}
      {spellings.map((spelling, index) => (
        <MapControl key={spelling.key} spelling={spelling} types={types} index={index} map={map} onMapped={setApplied} suggestion={suggestions[spelling.key]} />
      ))}
      {spellings.length === 0 && applied !== null && (
        <p role="status" className="text-[13px] text-ink">{itemText(`Applied to ${applied} ${applied === 1 ? "row" : "rows"}. Every equipment type is recognised.`, words)}</p>
      )}
    </section>
  );
}

type CommitPromptProps = {
  /** "Add 3 assets to <site>". */
  label: string;
  siteName: string;
  added: number;
  /** Why the button is disabled, or `null` when it is not. */
  blocked: string | null;
  confirming: boolean;
  pending: boolean;
  state: CommitState;
  onStart?: () => void;
  onCancel?: () => void;
  action?: () => void;
};

/** Two steps: the first button only asks, and nothing is added until "Add assets" is pressed. */
export function CommitPrompt({ label, siteName, added, blocked, confirming, pending, state, onStart, onCancel, action }: CommitPromptProps) {
  return (
    <div className="flex flex-col gap-2">
      {confirming ? (
        <form action={action} className="flex flex-col gap-2">
          <p className="text-[13px] font-medium text-ink">{`Add ${added} ${added === 1 ? "asset" : "assets"} to ${siteName}? Skipped rows stay on the import.`}</p>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" variant="primary" disabled={pending}>
              {pending ? "Adding…" : "Add assets"}
            </Button>
            <Button onClick={onCancel}>Cancel</Button>
          </div>
        </form>
      ) : (
        <div>
          {/* A long site name wraps on a phone instead of running past the card. */}
          <Button variant="primary" disabled={blocked !== null} onClick={onStart} className="h-auto! min-h-11 py-2 text-left whitespace-normal! lg:min-h-[34px]">
            {label}
          </Button>
        </div>
      )}
      {blocked && <p className="text-[13px] text-ink-2">{blocked}</p>}
      <Alert message={commitMessage(state)} />
    </div>
  );
}

export function CommitControl({ commit, ...props }: Omit<CommitPromptProps, "confirming" | "pending" | "state" | "onStart" | "onCancel" | "action"> & { commit: () => Promise<CommitState> }) {
  const [confirming, setConfirming] = useState(false);
  const [state, formAction, pending] = useActionState<CommitState>(async () => {
    const answer = await commit();
    setConfirming(false);
    return answer;
  }, { status: "idle" });
  return (
    <CommitPrompt {...props} confirming={confirming} pending={pending} state={state} onStart={() => setConfirming(true)} onCancel={() => setConfirming(false)} action={formAction} />
  );
}
