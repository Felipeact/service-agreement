import type { ComponentProps } from "react";
import { FIELD_CLASS } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type SelectProps = Omit<ComponentProps<"select">, "id"> & {
  id: string;
  /** Visible label above the field. */
  label: string;
  /** Shown under the field, and announced with it, when set. */
  error?: string;
};

/** A native select with the same label, height and error contract as `TextInput`. */
export function Select({ id, label, error, className = "", children, ...props }: SelectProps) {
  const errorId = `${id}-error`;
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="text-[13px] font-medium text-ink">
        {label}
      </label>
      <select
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={cn(FIELD_CLASS, "h-11 lg:h-[34px]", error && "border-danger")}
        {...props}
      >
        {children}
      </select>
      {error && (
        <p id={errorId} className="text-[12px] font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
