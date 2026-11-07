import type { ComponentProps } from "react";

type SearchInputProps = Omit<ComponentProps<"input">, "type"> & {
  /** Accessible name; the field has no visible label. */
  label: string;
  /** A key that focuses this field, shown at its right edge on desktop. The page owns the listener; pass it only while the field is empty. */
  shortcut?: string;
  /** `night` is the field on the dark shell (the sidebar): a lighter well with a border that holds 3:1 on Night. */
  tone?: "light" | "night";
};

const TONES = {
  light: { icon: "text-ink-2", field: "border-field bg-surface text-ink placeholder:text-ink-2" },
  night: { icon: "text-night-ink", field: "border-surface/40 bg-surface/10 text-surface placeholder:text-night-ink" },
};

export function SearchInput({ label, shortcut, tone = "light", className = "", ...props }: SearchInputProps) {
  return (
    <div className={`relative ${className}`}>
      <svg
        aria-hidden="true"
        viewBox="0 0 16 16"
        className={`pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 ${TONES[tone].icon}`}
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
        aria-keyshortcuts={shortcut}
        className={`h-11 w-full rounded-control border pr-3 pl-8 text-[13px] transition-colors duration-150 lg:h-[34px] ${TONES[tone].field} ${shortcut ? "lg:pr-9" : ""}`}
        {...props}
      />
      {shortcut && (
        <kbd
          aria-hidden="true"
          className={`pointer-events-none absolute top-1/2 right-2 hidden -translate-y-1/2 rounded-[4px] border px-1.5 text-[11px] leading-4 font-medium lg:block ${
            tone === "night" ? "border-surface/30 text-night-ink" : "border-hairline text-ink-2"
          }`}
        >
          {shortcut}
        </kbd>
      )}
    </div>
  );
}
