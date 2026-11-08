"use server";

import { redirect } from "next/navigation";
import { getContainer } from "@/composition";
import { validateTypeName } from "@/domain/task-library";
import { canEditTaskLibrary, type TypeFormState } from "@/components/task-library/state";

const text = (formData: FormData, name: string) => String(formData.get(name) ?? "");
const library = (code?: string) => (code ? `/task-library?type=${encodeURIComponent(code)}` : "/task-library");

/** The signed-in member, else a redirect to /login. The org always comes from the member, never from the form. */
async function writer() {
  const container = await getContainer();
  const member = await container.currentMember();
  if (member.status !== "member") redirect("/login");
  return { container, member, allowed: canEditTaskLibrary(member.role) };
}

/** Adds a type to the member's org and opens it (type-editor S1). */
export async function createTypeAction(_state: TypeFormState, formData: FormData): Promise<TypeFormState> {
  const name = text(formData, "name");
  const { container, member, allowed } = await writer();
  if (!allowed) return { status: "forbidden", name };
  const checked = validateTypeName(name);
  if (!checked.ok) return { status: "invalid", name };
  const created = await container.createLibraryType(member.orgId, checked.name);
  if (!created.ok) return { status: created.code, name };
  redirect(library(created.code));
}

/** Changes a type's name and keeps it selected (type-editor S2). */
export async function renameTypeAction(_state: TypeFormState, formData: FormData): Promise<TypeFormState> {
  const name = text(formData, "name");
  const typeCode = text(formData, "typeCode");
  const { container, allowed } = await writer();
  if (!allowed) return { status: "forbidden", name };
  const checked = validateTypeName(name);
  if (!checked.ok) return { status: "invalid", name };
  const renamed = await container.renameLibraryType(typeCode, checked.name);
  if (!renamed.ok) return { status: renamed.code, name };
  redirect(library(typeCode));
}

/** Removes a type while nothing uses it (type-editor S3). */
export async function removeTypeAction(_state: TypeFormState, formData: FormData): Promise<TypeFormState> {
  const { container, allowed } = await writer();
  if (!allowed) return { status: "forbidden", name: "" };
  const removed = await container.removeLibraryType(text(formData, "typeCode"));
  if (!removed.ok) return { status: removed.code, name: "" };
  redirect(library());
}

/** Restores a seeded type from its pack (type-editor S5). */
export async function resetTypeAction(_state: TypeFormState, formData: FormData): Promise<TypeFormState> {
  const typeCode = text(formData, "typeCode");
  const { container, allowed } = await writer();
  if (!allowed) return { status: "forbidden", name: "" };
  const reset = await container.resetLibraryType(typeCode);
  if (!reset.ok) return { status: reset.code, name: "" };
  redirect(library(typeCode));
}
