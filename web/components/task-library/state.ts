import type { MemberRole } from "@/application/ports";
import type { TaskLibraryErrors, TaskLibraryInput } from "@/domain/task-library";

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
