"use client";

import { useActionState } from "react";
import type { BillingInterval, PlanKey } from "@/domain/billing";
import { startTrialAction } from "./actions";
import { RegisterFields } from "./register-fields";
import { INITIAL_PRICING_STATE } from "./state";

export function RegisterForm({ initialPlan, initialInterval }: { initialPlan?: PlanKey; initialInterval?: BillingInterval }) {
  const [state, action, pending] = useActionState(startTrialAction, INITIAL_PRICING_STATE);
  return <RegisterFields state={state} pending={pending} initialPlan={initialPlan} initialInterval={initialInterval} action={action} />;
}
