"use server";

import { redirect } from "next/navigation";
import type { FinishResult, PlanChangeResult, StartResult, SubscriptionResult } from "@/components/billing/state";
import { PLAN_KEYS } from "@/domain/billing";
import { getContainer } from "@/composition";

/** The member the action acts for, from the session only; a signed-out or no-membership user goes to sign in. */
async function memberOrLogin() {
  const { currentMember } = await getContainer();
  const member = await currentMember();
  if (member.status !== "member") redirect("/login");
  return { orgId: member.orgId, role: member.role };
}

/** A SetupIntent id as Stripe writes it; anything else never reaches the use case (billing-page AC 18). */
const SETUP_INTENT_ID = /^seti_[A-Za-z0-9]+$/;

/** Asks for a SetupIntent for this org's customer; the browser sends nothing. */
export async function startCardUpdateAction(): Promise<StartResult> {
  const member = await memberOrLogin();
  const { startCardUpdate } = await getContainer();
  const started = await startCardUpdate(member);
  if (started.ok) return { status: "ready", clientSecret: started.clientSecret };
  return { status: started.code === "forbidden" ? "forbidden" : "unavailable" };
}

/** Makes the confirmed card the default. Only a SetupIntent id comes from the browser, and the server re-reads it from Stripe. */
export async function finishCardUpdateAction(setupIntentId: string): Promise<FinishResult> {
  const member = await memberOrLogin();
  if (typeof setupIntentId !== "string" || !SETUP_INTENT_ID.test(setupIntentId)) return { status: "failed" };
  const { finishCardUpdate } = await getContainer();
  const finished = await finishCardUpdate(member, setupIntentId);
  if (finished.ok) return { status: "saved" };
  return { status: finished.code === "forbidden" ? "forbidden" : "failed" };
}

async function subscriptionAction(name: "cancelSubscription" | "resumeSubscription"): Promise<SubscriptionResult> {
  const member = await memberOrLogin();
  const container = await getContainer();
  const done = await container[name](member);
  if (done.ok) return { status: "done" };
  return { status: done.code === "forbidden" ? "forbidden" : "unavailable" };
}

/** Ends the subscription at the end of the period; the browser sends nothing. */
export async function cancelSubscriptionAction(): Promise<SubscriptionResult> {
  return subscriptionAction("cancelSubscription");
}

/** Clears an end set by cancelling. */
export async function resumeSubscriptionAction(): Promise<SubscriptionResult> {
  return subscriptionAction("resumeSubscription");
}

/**
 * Moves the org to another plan. Only the plan key comes from the browser and it must be one of the three; the org, the role and
 * the Stripe ids come from the session and `org_billing` (plan-change AC 15).
 */
export async function changePlanAction(planKey: string): Promise<PlanChangeResult> {
  const member = await memberOrLogin();
  if (typeof planKey !== "string" || !PLAN_KEYS.some((key) => key === planKey)) return { status: "failed" };
  const { changePlan } = await getContainer();
  const changed = await changePlan(member, planKey);
  if (changed.ok) return { status: "done" };
  if (changed.code === "forbidden") return { status: "forbidden" };
  return { status: changed.code === "same_plan" ? "same_plan" : "failed" };
}
