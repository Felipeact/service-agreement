import { Suspense } from "react";
import { MemberGate } from "./member-gate";

/** The session is read at request time, so the gate streams in behind Suspense (door 6). */
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <Suspense fallback={<div aria-busy="true" className="min-h-dvh" />}>
      <MemberGate>{children}</MemberGate>
    </Suspense>
  );
}
