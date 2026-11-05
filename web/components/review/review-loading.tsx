/** The tenant is unknown until the link is read, so the skeleton names no one (customer-portal Observable, loading state). */
export function ReviewLoading() {
  return (
    <div className="min-h-dvh bg-ground">
      <div className="mx-auto flex max-w-[760px] flex-col gap-4 px-4 py-8">
        <p role="status" className="text-[13px] text-ink-2">
          Loading…
        </p>
        <div aria-hidden className="h-24 rounded-panel border border-hairline bg-surface" />
        <div aria-hidden className="h-48 rounded-panel border border-hairline bg-surface" />
      </div>
    </div>
  );
}
