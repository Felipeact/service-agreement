import type { ReactNode } from "react";

/**
 * A template remounts on every navigation inside the app, so each screen eases in once (a short fade and a 6px
 * settle). It is the app's whole page transition: quick enough that nobody waits on it.
 */
export default function AppTemplate({ children }: { children: ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
