import type { ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary";

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: "bg-action text-surface hover:bg-action/90",
  secondary: "border border-hairline bg-surface text-ink hover:bg-ground",
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

/** 44px tall below desktop for touch, 34px on desktop. */
export function Button({ variant = "secondary", type = "button", className = "", ...props }: ButtonProps) {
  return (
    <button
      type={type}
      data-variant={variant}
      className={`inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-control px-3.5 text-[13px] font-semibold whitespace-nowrap transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50 lg:h-[34px] ${VARIANT_CLASSES[variant]} ${className}`}
      {...props}
    />
  );
}
