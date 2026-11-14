"use client";

import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";

/**
 * One place that decides how every `motion` component in the app behaves for a visitor who asks for less movement:
 * transforms (slides, rises, scales) are dropped, while opacity and colour changes stay, so a state change is still seen.
 */
export function MotionRoot({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
