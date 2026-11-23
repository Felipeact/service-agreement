/**
 * The page-level motion vocabulary for the mockup pages, as plain objects so a server component can hand them to a
 * `motion/react-client` element. `MotionRoot` turns the transforms off for a visitor who asks for less movement.
 *
 * - `REVEAL`: a section rises and fades in as it scrolls into view.
 * - `STAGGER` + `ITEM`: a grid or row whose children arrive one after another.
 * - `TAP`: the press feedback on a button-looking link.
 */

const EASE_OUT = [0.16, 1, 0.3, 1] as const;

export const REVEAL = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE_OUT } },
};

export const STAGGER = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};

export const ITEM = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE_OUT } },
};

/** Animate once, when 15% of the element is on screen. */
export const VIEWPORT = { once: true, amount: 0.15 } as const;

export const TAP = { scale: 0.98 } as const;
