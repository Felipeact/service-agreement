/**
 * What the success page says while a paid workspace is built (workspace-pending-state S1). The page asks the database for the
 * answer about its Checkout session; this decides what the visitor sees from the answers so far.
 */

/** Ask every 3 seconds, at most 20 times (about a minute), then stop and say it is taking longer than usual. */
export const WORKSPACE_POLL_MS = 3000;
export const WORKSPACE_MAX_POLLS = 20;

/** What one ask came back with. `unavailable` is a failed ask: the action or the database could not answer. */
export type WorkspaceAnswer = "pending" | "ready" | "refused" | "unavailable";

/** `waiting` keeps asking; the other three are final. */
export type WorkspacePanel = "waiting" | "ready" | "refused" | "slow";

export function panelFor(answers: readonly WorkspaceAnswer[]): WorkspacePanel {
  const last = answers.at(-1);
  if (last === "ready") return "ready";
  if (last === "refused") return "refused";
  if (last === "unavailable") return "slow";
  return answers.length >= WORKSPACE_MAX_POLLS ? "slow" : "waiting";
}
