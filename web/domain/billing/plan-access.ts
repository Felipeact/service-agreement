import { PLANS, type PlanKey } from ".";

/** The two ways another program reaches a company's data: an AI client over MCP, or code over the REST API. */
export type AccessDoor = "mcp" | "api";

/** What a plan lets a door do: nothing, read, or read plus the draft writes. */
export type AccessLevel = "none" | "read" | "write";

export type PlanAccess = { mcp: AccessLevel; api: AccessLevel; callsPerMinute: number; /** Ask AI questions the whole company may ask in a calendar month. */ assistantQuestionsPerMonth: number };

/**
 * What each plan includes beyond agreements and imports (decision of 2026-11-27, prices still the owner's call): Starter has the
 * in-app assistant only; Team adds read access over MCP and the API; Business adds the draft writes and the highest rate.
 * Reads cost us no model fees (the caller's own client pays), so they are the cheap way to make Team worth its price.
 */
export const PLAN_ACCESS: Readonly<Record<PlanKey, PlanAccess>> = {
  starter: { mcp: "none", api: "none", callsPerMinute: 0, assistantQuestionsPerMonth: 100 },
  team: { mcp: "read", api: "read", callsPerMinute: 120, assistantQuestionsPerMonth: 300 },
  business: { mcp: "write", api: "write", callsPerMinute: 600, assistantQuestionsPerMonth: 1000 },
};

/** No plan (no billing row, or the read failed): no API, and the smallest assistant allowance, so cost stays bounded. */
const NO_ACCESS: PlanAccess = { mcp: "none", api: "none", callsPerMinute: 0, assistantQuestionsPerMonth: 100 };

/** The access of a plan key; an unknown or missing plan (no billing row) gets none. */
export function accessOf(plan: string | null | undefined): PlanAccess {
  return plan && plan in PLAN_ACCESS ? PLAN_ACCESS[plan as PlanKey] : NO_ACCESS;
}

/** Whether the plan lets this door run a tool of this kind (`read` or `write`). */
export function planAllows(plan: string | null | undefined, door: AccessDoor, access: "read" | "write"): boolean {
  const level = accessOf(plan)[door];
  return level === "write" || (level === "read" && access === "read");
}

/** The cheapest plan whose access for the door reaches the level, for "available on Team and up" sentences. */
export function cheapestPlanFor(door: AccessDoor, access: "read" | "write"): string {
  const plan = PLANS.find((candidate) => planAllows(candidate.key, door, access));
  return plan ? plan.name : "Business";
}

const DOOR_NAME: Record<AccessDoor, string> = { mcp: "The AI (MCP) connection", api: "The API" };

/** The sentence a refused member or client reads. */
export function planAccessMessage(door: AccessDoor, access: "read" | "write", plan: string | null | undefined): string {
  const what = access === "write" ? `${DOOR_NAME[door]} can only read on your plan; creating drafts` : DOOR_NAME[door];
  return `${what} is available on the ${cheapestPlanFor(door, access)} plan and above${plan ? `; your company is on ${PLANS.find((p) => p.key === plan)?.name ?? plan}` : ""}. An owner can change the plan in Settings → Billing.`;
}

/** Whether a plan includes the developer area (API reference, MCP guide, activity log): any plan that reaches either door. */
export const hasDeveloperAccess = (plan: string | null | undefined): boolean => planAllows(plan, "api", "read") || planAllows(plan, "mcp", "read");
