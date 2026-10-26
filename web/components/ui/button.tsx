import type { ButtonHTMLAttributes } from "react";

export type ButtonVariant = "primary" | "secondary" | "danger";

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: "bg-action text-surface hover:bg-action/90",
  secondary: "border border-hairline bg-surface text-ink hover:bg-ground",
  danger: "bg-danger text-surface hover:bg-danger/90",
};

/** The button look, shared with `LinkButton`. 44px tall below desktop for touch, 34px on desktop. */
export function buttonClass(variant: ButtonVariant, className = "") {
  return `inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-control px-3.5 text-[13px] font-semibold whitespace-nowrap transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50 lg:h-[34px] ${VARIANT_CLASSES[variant]} ${className}`;
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

export function Button({ variant = "secondary", type = "button", className = "", ...props }: ButtonProps) {
  return <button type={type} data-variant={variant} className={buttonClass(variant, className)} {...props} />;
}
