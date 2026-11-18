import type { ReactNode } from "react";

/**
 * The product's line icons: one 1.6px stroke, rounded ends, drawn on a 20px grid and tinted by the text colour.
 * They sit beside a text label or carry an accessible name of their own, never alone and unlabelled.
 */
const PATHS = {
  /** A board of columns: the Pipeline. */
  pipeline: (
    <>
      <rect x="3" y="3.5" width="5" height="13" rx="1.5" />
      <rect x="10" y="3.5" width="7" height="6" rx="1.5" />
      <rect x="10" y="11.5" width="7" height="5" rx="1.5" />
    </>
  ),
  /** A page with lines: an agreement. */
  document: (
    <>
      <path d="M5.5 2.75h6l3.75 3.75v9.75a1 1 0 0 1-1 1h-8.75a1 1 0 0 1-1-1v-12.5a1 1 0 0 1 1-1Z" />
      <path d="M11.25 2.75v4h4M7.5 11h5M7.5 14h3.5" />
    </>
  ),
  /** A page split into a header and two panes: a template. */
  template: (
    <>
      <rect x="3" y="3.5" width="14" height="13" rx="2" />
      <path d="M3 8h14M8 8v8.5" />
    </>
  ),
  /** Two people: customers. */
  people: (
    <>
      <circle cx="7.75" cy="7" r="2.75" />
      <path d="M2.75 16.25c.4-2.6 2.4-4.25 5-4.25s4.6 1.65 5 4.25" />
      <path d="M13 4.6a2.75 2.75 0 0 1 0 5.2M14.4 12.2c1.6.5 2.6 1.8 2.85 4" />
    </>
  ),
  /** A pin over a baseline: sites. */
  pin: (
    <>
      <path d="M10 17.25s5.25-4.6 5.25-8.6a5.25 5.25 0 0 0-10.5 0c0 4 5.25 8.6 5.25 8.6Z" />
      <circle cx="10" cy="8.65" r="1.9" />
    </>
  ),
  /** A tray with an arrow rising: an upload. */
  upload: (
    <>
      <path d="M10 13V3.75M6.75 6.9 10 3.65l3.25 3.25" />
      <path d="M3.25 12.75v2.5a1 1 0 0 0 1 1h11.5a1 1 0 0 0 1-1v-2.5" />
    </>
  ),
  gear: (
    <>
      <circle cx="10" cy="10" r="2.5" />
      <path d="M10 2.75v1.8M10 15.45v1.8M17.25 10h-1.8M4.55 10h-1.8M15.1 4.9l-1.3 1.3M6.2 13.8l-1.3 1.3M15.1 15.1l-1.3-1.3M6.2 6.2 4.9 4.9" />
    </>
  ),
  search: (
    <>
      <circle cx="9" cy="9" r="5.25" />
      <path d="m13 13 3.5 3.5" />
    </>
  ),
  plus: <path d="M10 4.25v11.5M4.25 10h11.5" />,
  bell: (
    <>
      <path d="M5.25 8.25a4.75 4.75 0 0 1 9.5 0c0 3.5 1.5 4.75 1.5 4.75H3.75s1.5-1.25 1.5-4.75Z" />
      <path d="M8.25 15.75a1.9 1.9 0 0 0 3.5 0" />
    </>
  ),
  trend: <path d="m3.5 13.5 4.25-4.5 3 3 5.75-6M12.25 6h4.25v4.25" />,
  clock: (
    <>
      <circle cx="10" cy="10" r="6.75" />
      <path d="M10 6.25V10l2.6 1.6" />
    </>
  ),
  chevron: <path d="m7.75 4.75 5.25 5.25-5.25 5.25" />,
  mail: (
    <>
      <rect x="2.75" y="4.5" width="14.5" height="11" rx="2" />
      <path d="m3.5 6 6.5 5 6.5-5" />
    </>
  ),
  file: (
    <>
      <path d="M5.5 2.75h5.5l4 4v9.5a1 1 0 0 1-1 1h-8.5a1 1 0 0 1-1-1v-12.5a1 1 0 0 1 1-1Z" />
      <path d="M11 2.75v4h4" />
    </>
  ),
  close: <path d="m5 5 10 10M15 5 5 15" />,
  menu: <path d="M3.5 6h13M3.5 10h13M3.5 14h13" />,
  /** A window with a left rail: show or hide the sidebar. */
  sidebar: (
    <>
      <rect x="3" y="3.5" width="14" height="13" rx="2" />
      <path d="M8 3.5v13" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="4.5" width="14" height="12.5" rx="2" />
      <path d="M3 8.5h14M7 2.75v3M13 2.75v3" />
    </>
  ),
  minus: <path d="M4.25 10h11.5" />,
  check: <path d="m4.5 10.5 3.5 3.5 7.5-8" />,
  download: <path d="M10 3.5v9M6 8.75l4 4 4-4M4 16.25h12" />,
  external: <path d="M11.5 3.75h4.75V8.5M16 4 9.5 10.5M8.5 4.75H5.25a1.5 1.5 0 0 0-1.5 1.5v8.5a1.5 1.5 0 0 0 1.5 1.5h8.5a1.5 1.5 0 0 0 1.5-1.5V11.5" />,
  eye: (
    <>
      <path d="M2.75 10s2.75-5 7.25-5 7.25 5 7.25 5-2.75 5-7.25 5-7.25-5-7.25-5Z" />
      <circle cx="10" cy="10" r="2.25" />
    </>
  ),
  spark: <path d="M10 2.75c.6 3.6 1.65 4.65 5.25 5.25-3.6.6-4.65 1.65-5.25 5.25-.6-3.6-1.65-4.65-5.25-5.25 3.6-.6 4.65-1.65 5.25-5.25ZM15.25 13.25c.25 1.3.7 1.75 2 2-1.3.25-1.75.7-2 2-.25-1.3-.7-1.75-2-2 1.3-.25 1.75-.7 2-2Z" />,
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof PATHS;

export function Icon({ name, className = "size-5" }: { name: IconName; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className={`shrink-0 ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {PATHS[name]}
    </svg>
  );
}
