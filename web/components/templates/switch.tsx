/** A labelled on/off switch: a checkbox with the switch role, 44px tall below desktop. */
export function Switch({ id, label, hint, checked, onChange, error }: { id: string; label: string; hint?: string; checked: boolean; onChange: (next: boolean) => void; error?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="flex min-h-11 cursor-pointer items-center gap-3 lg:min-h-9">
        <input id={id} type="checkbox" role="switch" checked={checked} onChange={(event) => onChange(event.target.checked)} className="size-4 shrink-0 accent-action" />
        <span className="flex flex-col">
          <span className="text-[13px] font-medium text-ink">{label}</span>
          {hint && <span className="text-[12px] text-ink-2">{hint}</span>}
        </span>
      </label>
      {error && <p className="text-[12px] font-medium text-danger">{error}</p>}
    </div>
  );
}
