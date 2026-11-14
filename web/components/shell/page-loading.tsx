import { PageHeader } from "./page-header";

/** The loading state of a screen: its header, then a status line. */
export function PageLoading({ title }: { title: string }) {
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={title} />
      <div aria-hidden="true" className="flex flex-col gap-3">
        <div className="bone h-24 rounded-panel bg-board" />
        <div className="bone h-12 rounded-panel bg-board [animation-delay:150ms]" />
        <div className="bone h-12 rounded-panel bg-board [animation-delay:300ms]" />
      </div>
      <p role="status" className="sr-only">
        Loading…
      </p>
    </div>
  );
}
