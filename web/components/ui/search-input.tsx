import type { ComponentProps } from "react";

type SearchInputProps = Omit<ComponentProps<"input">, "type"> & {
  /** Accessible name; the field has no visible label. */
  label: string;
};

export function SearchInput({ label, className = "", ...props }: SearchInputProps) {
  return (
    <div className={`relative ${className}`}>
      <svg
        aria-hidden="true"
        viewBox="0 0 16 16"
        className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-ink-2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      >
        <circle cx="7" cy="7" r="4.75" />
        <path d="m10.5 10.5 3.5 3.5" strokeLinecap="round" />
      </svg>
      <input
        type="search"
        aria-label={label}
        className="h-11 w-full rounded-control border border-hairline bg-surface pr-3 pl-8 text-[13px] text-ink placeholder:text-ink-2 lg:h-[34px]"
        {...props}
      />
    </div>
  );
}
