import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * The look every text control shares (docs/DESIGN.md "Inputs"): a 4px radius, a Field border that turns Action blue with a
 * soft ring on focus. A control with an error adds `border-danger` itself, so the message and the border always agree.
 */
export const FIELD_CLASS =
  "w-full min-w-0 rounded-control border border-field bg-surface px-3 text-[14px] text-ink transition-[border-color,box-shadow] duration-150 outline-none placeholder:text-ink-2 focus-visible:border-action focus-visible:ring-[3px] focus-visible:ring-action/15 disabled:cursor-not-allowed disabled:opacity-60"

/** The shadcn `Input`, restyled to the Field Protocol field: 44px tall below desktop for touch, 34px from there up. */
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  const invalid = props["aria-invalid"] === true || props["aria-invalid"] === "true"
  return <input {...props} type={type} data-slot="input" className={cn(FIELD_CLASS, "h-11 lg:h-10", invalid && "border-danger", className)} />
}

export { Input }
