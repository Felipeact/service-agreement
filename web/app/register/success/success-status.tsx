"use client";

import { useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { checkWorkspaceAction } from "./actions";
import { WorkspaceStatus } from "./status-panel";

/** Reads `session_id` from the address on the client, so the page itself stays static; asks the public Server Action. */
export function SuccessStatus({ fallback }: { fallback: ReactNode }) {
  const sessionId = useSearchParams().get("session_id");
  return <WorkspaceStatus sessionId={sessionId} check={checkWorkspaceAction} fallback={fallback} />;
}
