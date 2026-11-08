"use server";

import { redirect } from "next/navigation";
import { getContainer } from "@/composition";
import { validateTaskLibraryType, type TaskInput, type TaskLibraryInput } from "@/domain/task-library";
import { canEditTaskLibrary, type TaskLibraryFormState } from "@/components/task-library/state";

const texts = (formData: FormData, name: string) => formData.getAll(name).map(String);

/** The form's rows: `taskDescription` repeats once per row and row `i` sends its months as `taskMonths-i`. */
function readInput(formData: FormData): TaskLibraryInput {
  const tasks: TaskInput[] = texts(formData, "taskDescription").map((description, index) => ({
    description,
    visitMonths: texts(formData, `taskMonths-${index}`),
  }));
  return { typeCode: String(formData.get("typeCode") ?? ""), defaultVisitMonths: texts(formData, "defaultVisitMonths"), tasks };
}

/** Replaces one type's default months and checklist. The org comes from the signed-in member, never the form. */
export async function saveTaskLibraryAction(_state: TaskLibraryFormState, formData: FormData): Promise<TaskLibraryFormState> {
  const values = readInput(formData);
  const { currentMember, saveTaskLibraryType } = await getContainer();

  const member = await currentMember();
  if (member.status !== "member") redirect("/login");
  if (!canEditTaskLibrary(member.role)) return { status: "forbidden", values };

  const checked = validateTaskLibraryType(values);
  if (!checked.ok) return { status: "invalid", errors: checked.errors, values };

  const saved = await saveTaskLibraryType(values.typeCode, checked.value);
  return saved.ok ? { status: "saved", values } : { status: saved.code, values };
}
