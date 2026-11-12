import type { DraftType } from "@/domain/task-library/draft";

/** What `addCatalogTypesAction` answers: the names added, in order, or why nothing was (other-trade-draft door 1). */
export type AddTypesAnswer =
  | { ok: true; added: string[] }
  | { ok: false; code: "forbidden" | "invalid" | "unavailable" }
  | { ok: false; code: "duplicate"; name: string | null };

export type DraftAction =
  | { type: "set"; types: DraftType[] }
  | { type: "rename"; index: number; name: string }
  | { type: "editTask"; index: number; task: number; text: string }
  | { type: "removeTask"; index: number; task: number }
  | { type: "setSynonyms"; index: number; raw: string }
  | { type: "toggleMonth"; index: number; month: number }
  | { type: "removeType"; index: number };

const change = (types: DraftType[], index: number, edit: (type: DraftType) => DraftType) => types.map((type, i) => (i === index ? edit(type) : type));

/** Edits to the draft the owner is reviewing. Pure: nothing is sent or stored until Add to my catalog (AC 16). */
export function draftReducer(types: DraftType[], action: DraftAction): DraftType[] {
  switch (action.type) {
    case "set":
      return action.types;
    case "rename":
      return change(types, action.index, (type) => ({ ...type, name: action.name }));
    case "editTask":
      return change(types, action.index, (type) => ({ ...type, tasks: type.tasks.map((task, i) => (i === action.task ? { description: action.text } : task)) }));
    case "removeTask":
      return change(types, action.index, (type) => ({ ...type, tasks: type.tasks.filter((_, i) => i !== action.task) }));
    case "setSynonyms":
      return change(types, action.index, (type) => ({ ...type, synonyms: action.raw.split(",").map((s) => s.trim()) }));
    case "toggleMonth":
      return change(types, action.index, (type) => {
        const months = type.defaultVisitMonths.includes(action.month) ? type.defaultVisitMonths.filter((m) => m !== action.month) : [...type.defaultVisitMonths, action.month];
        return { ...type, defaultVisitMonths: months.sort((a, b) => a - b) };
      });
    case "removeType":
      return types.filter((_, i) => i !== action.index);
  }
}
