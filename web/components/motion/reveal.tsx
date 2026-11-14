"use client";

import { motion, useInView } from "motion/react";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

const EASE_OUT = [0.16, 1, 0.3, 1] as const;

const TAGS = { div: motion.div, li: motion.li, section: motion.section, figure: motion.figure, p: motion.p } as const;

type RevealProps = {
  children: ReactNode;
  as?: keyof typeof TAGS;
  className?: string;
  /** Position among siblings that appear together; each step waits 60ms more, capped at 5 steps. */
  index?: number;
  /** How far it rises, in px. */
  distance?: number;
};

/**
 * Content that arrives as it scrolls into view. It is fully visible in the server HTML and on first paint: only a
 * block that starts below the fold is hidden (before the browser paints), then eased in once it is 12% into view.
 * Anything already on screen, and any visitor without script, just sees the content.
 */
export function Reveal({ children, as = "div", className, index = 0, distance = 18 }: RevealProps) {
  const ref = useRef<HTMLElement>(null);
  const [belowFold, setBelowFold] = useState(false);
  const inView = useInView(ref, { once: true, margin: "0px 0px -12% 0px" });

  useLayoutEffect(() => {
    const el = ref.current;
    if (el && el.getBoundingClientRect().top > window.innerHeight * 0.92) setBelowFold(true);
  }, []);

  const Tag = TAGS[as];
  const hidden = belowFold && !inView;
  return (
    <Tag
      ref={ref as never}
      className={className}
      initial={false}
      animate={
        hidden
          ? { opacity: 0, y: distance, transition: { duration: 0 } }
          : { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE_OUT, delay: Math.min(index, 5) * 0.06 } }
      }
    >
      {children}
    </Tag>
  );
}
