import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";

import { cn } from "@/lib/utils";

/**
 * Field Protocol buttons (docs/DESIGN.md "Buttons"): 4px radius, three heights.
 * Below desktop every size is at least 44px tall so it is a touch target.
 *
 * `primary`, `secondary` and `danger` are the names the app already used; `default`, `outline` and
 * `destructive` are the shadcn names the shadcn components (dialog, sheet, field) ask for. They map to the same looks.
 */
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-control text-[13px] font-semibold whitespace-nowrap transition-[color,background-color,border-color,transform] duration-150 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action active:scale-[0.97] motion-reduce:active:scale-100 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        primary: "bg-action text-surface hover:bg-action-hover active:bg-action-press",
        secondary: "border border-hairline bg-surface text-ink hover:border-line-strong hover:bg-ground",
        danger:
          "border border-danger-border bg-danger-tint text-danger hover:bg-danger hover:text-surface hover:border-danger",
        ghost: "text-ink hover:bg-board",
        link: "h-auto px-0 text-action underline-offset-4 hover:underline",
        default: "bg-action text-surface hover:bg-action-hover active:bg-action-press",
        outline: "border border-hairline bg-surface text-ink hover:border-line-strong hover:bg-ground",
        destructive:
          "border border-danger-border bg-danger-tint text-danger hover:bg-danger hover:text-surface hover:border-danger",
      },
      size: {
        sm: "h-11 px-3 text-xs lg:h-8",
        md: "h-11 px-4 lg:h-[38px]",
        lg: "h-11 px-5 text-base",
        icon: "size-11 lg:size-[38px]",
        "icon-sm": "size-11 lg:size-8",
      },
    },
    defaultVariants: { variant: "secondary", size: "md" },
  },
);

type ButtonVariant = NonNullable<VariantProps<typeof buttonVariants>["variant"]>;

/** The button look as a class string, shared with `LinkButton`. */
function buttonClass(variant: ButtonVariant, className = "") {
  return cn(buttonVariants({ variant }), className);
}

type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    /** Render the child element (a link, say) with the button's look instead of a `button`. */
    asChild?: boolean;
  };

/** A button. Defaults to `type="button"` so it never submits a form by accident. */
function Button({ variant = "secondary", size = "md", type = "button", asChild = false, className, ...props }: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp
      {...(asChild ? {} : { type })}
      data-slot="button"
      data-variant={variant}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { Button, buttonVariants, buttonClass };
export type { ButtonVariant };
