import type { ComponentProps } from "react";

type TextInputProps = Omit<ComponentProps<"input">, "id"> & {
  id: string;
  /** Visible label above the field. */
  label: string;
  /** Shown under the field, and announced with it, when set. */
  error?: string;
};

/** 44px tall below desktop for touch, 34px on desktop, like the search field. */
export function TextInput({ id, label, error, className = "", ...props }: TextInputProps) {
  const errorId = `${id}-error`;
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="text-[13px] font-medium text-ink">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={`h-11 w-full rounded-control border bg-surface px-3 text-[13px] text-ink placeholder:text-ink-2 lg:h-[34px] ${error ? "border-danger" : "border-hairline"}`}
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
