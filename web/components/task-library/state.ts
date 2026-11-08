import type { MemberRole, TypeFailure } from "@/application/ports";
import { TYPE_NAME_MESSAGE, type TaskLibraryErrors, type TaskLibraryInput } from "@/domain/task-library";

/** What the editor shows after a save attempt; every state past `idle` keeps what was typed. */
export type TaskLibraryFormState =
  | { status: "idle" }
  | { status: "saved"; values: TaskLibraryInput }
  | { status: "invalid"; errors: TaskLibraryErrors; values: TaskLibraryInput }
  | { status: "forbidden" | "not_found" | "unavailable"; values: TaskLibraryInput };

/** Owners and admins write the library (the `asset_types` and `asset_type_tasks` policies); RLS still decides. */
export function canEditTaskLibrary(role: MemberRole): boolean {
  return role === "owner" || role === "admin";
}

export const TASK_LIBRARY_STATUS_MESSAGES = {
  saved: "Saved. New agreement drafts use this checklist; sent agreements keep theirs.",
  forbidden: "Only owners and admins can change the task library.",
  not_found: "This equipment type no longer exists.",
  unavailable: "We couldn't save your changes. Try again.",
} as const;

/** What an add, rename, removal or reset shows after an attempt; a success redirects, so it has no state of its own. */
export type TypeFormState = { status: "idle" } | { status: TypeFailure; name: string };

export type TypeAction = (state: TypeFormState, formData: FormData) => Promise<TypeFormState>;
export type TypeActions = { create: TypeAction; rename: TypeAction; remove: TypeAction; reset: TypeAction };

export const TYPE_STATUS_MESSAGES: Record<TypeFailure, string> = {
  invalid: TYPE_NAME_MESSAGE,
  conflict: "A type with that name already exists",
  in_use: "This type is still used by assets, service lines or import rows",
  no_pack: "This type has no pack to reset to",
  forbidden: "Only owners and admins can change the task library.",
  not_found: "This equipment type no longer exists.",
  unavailable: "We couldn't save your changes. Try again.",
};
