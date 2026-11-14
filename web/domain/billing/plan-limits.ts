import { PLANS } from "@/domain/billing";

/** What a refusal knows: the plan, what it allows, what the org holds or has used. */
export type PlanLimitDetail = { plan: string; limit: number; used: number };

/** Who is reading a refusal: owners and admins can change the plan, everyone else is told to ask one of them. */
export type PlanLimitAudience = "manager" | "staff";

/** The text and, for a manager, where to go to change the plan. */
export type PlanLimitNotice = { message: string; billingHref: string | null };

export const BILLING_HREF = "/settings/billing";

/** The plan's display name; an unknown key is shown as it is. */
export function planDisplayName(key: string): string {
  return PLANS.find((plan) => plan.key === key)?.name ?? key;
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** `2026-12-01` as `December 1`. */
export function formatResetDate(isoDate: string): string {
  const [, month, day] = isoDate.split("-").map(Number);
  return `${MONTHS[month - 1]} ${day}`;
}

/** Owners and admins can change the plan; the others are told to ask them. */
export const audienceOf = (role: string): PlanLimitAudience => (role === "owner" || role === "admin" ? "manager" : "staff");

/** The refusal a member reads when a plan limit stops them (plan-limits AC 5, 6, 15). */
export function planLimitMessage(
  kind: "agreements",
  detail: PlanLimitDetail,
  audience: PlanLimitAudience,
): PlanLimitNotice;
export function planLimitMessage(
  kind: "imports",
  detail: PlanLimitDetail & { resetsOn: string },
  audience: PlanLimitAudience,
): PlanLimitNotice;
export function planLimitMessage(kind: "agreements" | "imports", detail: PlanLimitDetail & { resetsOn?: string }, audience: PlanLimitAudience): PlanLimitNotice {
  const name = planDisplayName(detail.plan);
  const sentence =
    kind === "agreements"
      ? `Your ${name} plan allows ${detail.limit} live agreements and you have ${detail.used}.`
      : `Your ${name} plan allows ${detail.limit} AI imports a month and you have used ${detail.used}. The count resets on ${formatResetDate(detail.resetsOn ?? "")}.`;
  return audience === "manager"
    ? { message: sentence, billingHref: BILLING_HREF }
    : { message: `${sentence} Ask an owner or admin to change the plan.`, billingHref: null };
}

/** One usage figure beside its limit; `full` once the limit is reached. A missing limit means no plan, so nothing is full. */
export type UsageFigure = { used: number; limit: number | null };

export const isFull = (figure: UsageFigure): boolean => figure.limit !== null && figure.used >= figure.limit;

/** What `/settings/billing` shows under the plan name. */
export type OrgUsage = {
  plan: string | null;
  liveAgreements: UsageFigure;
  aiImports: UsageFigure;
  /** The tokens this month's imports used; absent when the database does not report them. Shown, never limited. */
  aiTokens?: { input: number; output: number };
  resetsOn: string;
};

/** What is left of a limit, never below zero; `null` when there is no limit. */
export const remaining = (figure: UsageFigure): number | null => (figure.limit === null ? null : Math.max(0, figure.limit - figure.used));

const tokenCount = new Intl.NumberFormat("en-CA");

/** "184,200 tokens" for the owner: the AI's reading and writing added together. */
export function formatTokens(tokens: { input: number; output: number }): string {
  const total = tokens.input + tokens.output;
  return `${tokenCount.format(total)} ${total === 1 ? "token" : "tokens"}`;
}
