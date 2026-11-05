import { PageHeader } from "./page-header";

/** The loading state of a screen: its header, then a status line. */
export function PageLoading({ title }: { title: string }) {
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={title} />
      <p role="status" className="text-[13px] text-ink-2">
        Loading…
      </p>
    </div>
  );
}
