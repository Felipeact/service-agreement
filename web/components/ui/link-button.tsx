import Link from "next/link";
import type { ComponentProps } from "react";
import { buttonClass, type ButtonVariant } from "./button";

type LinkButtonProps = ComponentProps<typeof Link> & { variant?: ButtonVariant };

/** A link that looks like a `Button`, for actions that open another page. */
export function LinkButton({ variant = "secondary", className = "", ...props }: LinkButtonProps) {
  return <Link data-variant={variant} className={buttonClass(variant, className)} {...props} />;
}
