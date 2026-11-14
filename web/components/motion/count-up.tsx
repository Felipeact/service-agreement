"use client";

import { animate, useReducedMotion } from "motion/react";
import { useLayoutEffect, useRef } from "react";

/**
 * A figure that counts to its value when it first appears and glides to the new value when it changes (the board's
 * follow-up filter, a refresh). The server HTML and a reduced-motion visitor get the final number at once. The text
 * is written straight into the element, so a count never re-renders its parent.
 */
export function CountUp({ value, format, snap = 1, className }: { value: number; format: (value: number) => string; /** The step the figure moves in while counting (100 for cents, so money passes through whole dollars only). */ snap?: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const shown = useRef<number | null>(null);
  const reduce = useReducedMotion();

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduce) {
      el.textContent = format(value);
      shown.current = value;
      return;
    }
    const from = shown.current ?? 0;
    if (from === value) return;
    el.textContent = format(from);
    const controls = animate(from, value, {
      duration: shown.current === null ? 0.9 : 0.5,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (latest) => {
        shown.current = latest;
        el.textContent = format(Math.round(latest / snap) * snap);
      },
      onComplete: () => {
        shown.current = value;
        el.textContent = format(value);
      },
    });
    return () => controls.stop();
  }, [value, format, snap, reduce]);

  return (
    <span ref={ref} className={className}>
      {format(value)}
    </span>
  );
}
