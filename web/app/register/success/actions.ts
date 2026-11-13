"use server";

import { getWorkspaceStatusContainer } from "@/composition";
import type { WorkspaceAnswer } from "@/domain/billing/workspace-state";

/**
 * The success page asks whether the workspace for its Checkout session is built (workspace-pending-state S1). Public like the
 * page it serves: the session id is the only input, and the answer is a single word. Any failure is `unavailable`, never thrown.
 */
export async function checkWorkspaceAction(sessionId: string): Promise<WorkspaceAnswer> {
  if (typeof sessionId !== "string") return "unavailable";
  try {
    const { workspaceStatus } = await getWorkspaceStatusContainer();
    return await workspaceStatus.forSession(sessionId);
  } catch {
    return "unavailable";
  }
}
