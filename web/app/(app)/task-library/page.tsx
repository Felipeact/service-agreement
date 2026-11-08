import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { TaskLibraryView } from "@/components/task-library/task-library-view";
import { getContainer } from "@/composition";
import { pickType } from "@/domain/task-library";
import { saveTaskLibraryAction } from "./actions";
import { createTypeAction, removeTypeAction, renameTypeAction, resetTypeAction } from "./type-actions";

const TYPE_ACTIONS = { create: createTypeAction, rename: renameTypeAction, remove: removeTypeAction, reset: resetTypeAction };

export const metadata: Metadata = { title: "Task library" };

/** `?type=<code>` picks the type shown; an unknown or repeated value shows the first one (task-library-page Surface). */
export async function TaskLibraryForRequest({ params }: { params: { type?: string | string[] } }) {
  const { currentMember, listTaskLibrary } = await getContainer();
  const member = await currentMember();
  if (member.status !== "member") redirect("/login");
  const types = await listTaskLibrary();
  return <TaskLibraryView types={types} selected={pickType(types, params.type)} role={member.role} action={saveTaskLibraryAction} typeActions={TYPE_ACTIONS} />;
}

export default async function TaskLibraryPage({ searchParams }: PageProps<"/task-library">) {
  return <TaskLibraryForRequest params={await searchParams} />;
}
