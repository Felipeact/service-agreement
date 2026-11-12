import type { ComponentProps } from "react";

type TextAreaProps = Omit<ComponentProps<"textarea">, "id"> & {
  id: string;
  /** Visible label above the field. */
  label: string;
  /** A line under the label that says what the field takes. */
  hint?: string;
  /** Shown under the field, and announced with it, when set. */
  error?: string;
};

/** A multi-line field with the same label and error contract as `TextInput`. */
export function TextArea({ id, label, hint, error, className = "", rows = 5, ...props }: TextAreaProps) {
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="text-[13px] font-medium text-ink">
        {label}
      </label>
      {hint && (
        <p id={hintId} className="text-[12px] text-ink-2">
          {hint}
        </p>
      )}
      <textarea
        id={id}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={[hint ? hintId : "", error ? errorId : ""].filter(Boolean).join(" ") || undefined}
        className={`w-full rounded-control border bg-surface px-3 py-2 text-[13px] text-ink placeholder:text-ink-2 ${error ? "border-danger" : "border-field"}`}
        {...props}
      />
      {error && (
        <p id={errorId} className="text-[12px] font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
