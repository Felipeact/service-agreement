import Link from "next/link";
import type { MemberRole } from "@/application/ports";
import { monthRunsLabel, monthsLabel } from "@/domain/agreement";
import type { LibraryType } from "@/domain/task-library";
import { PageHeader } from "@/components/shell/page-header";
import { EmptyPanel } from "@/components/ui/empty-panel";
import { TaskLibraryEditor } from "./task-library-editor";
import { canEditTaskLibrary, type TaskLibraryFormState } from "./state";

type Props = {
  types: LibraryType[];
  /** The type shown on the right; `null` only when the library is empty. */
  selected: LibraryType | null;
  role: MemberRole;
  action: (state: TaskLibraryFormState, formData: FormData) => Promise<TaskLibraryFormState>;
};

const ROW = "flex min-h-11 flex-col justify-center gap-0.5 px-3 py-2 lg:min-h-0";

/** The Task library page body: the equipment types, and the selected type's checklist and default months (task-library-page S1). */
export function TaskLibraryView({ types, selected, role, action }: Props) {
  if (!selected) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title="Task library" />
        <EmptyPanel title="No equipment types yet" text="The equipment types and checklists of your company appear here." />
      </div>
    );
  }
  const editable = canEditTaskLibrary(role);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Task library" />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:items-start">
        <nav aria-label="Equipment types">
          <ul className="flex flex-col divide-y divide-hairline rounded-panel border border-hairline bg-surface">
            {types.map((type) => (
              <li key={type.id}>
                <Link
                  href={`/task-library?type=${encodeURIComponent(type.code)}`}
                  aria-current={type.id === selected.id ? "page" : undefined}
                  className={`${ROW} hover:bg-ground aria-[current=page]:bg-action-tint`}
                >
                  <span className="text-[14px] font-semibold">{type.name}</span>
                  <span className="text-[13px] text-ink-2">{monthsLabel(type.defaultVisitMonths)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <section aria-label={selected.name} className="flex flex-col gap-4 rounded-panel border border-hairline bg-surface p-4">
          <h2 className="text-[17px] font-semibold">{selected.name}</h2>
          {editable ? (
            <TaskLibraryEditor key={selected.code} type={selected} action={action} />
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-[13px] text-ink-2">Default visit months: {monthsLabel(selected.defaultVisitMonths)}</p>
              <p className="text-[13px] text-ink-2">Only owners and admins can change the task library.</p>
              {selected.tasks.length === 0 ? (
                <p className="text-[13px] text-ink-2">No tasks yet.</p>
              ) : (
                <ol className="flex flex-col divide-y divide-hairline">
                  {selected.tasks.map((task, index) => (
                    <li key={index} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                      <span className="text-[14px]">{task.description}</span>
                      <span className="text-[13px] text-ink-2">{task.visitMonths ? monthRunsLabel(task.visitMonths) : "All visits"}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
