"use client";

import { useActionState } from "react";
import type { PlanKey } from "@/domain/billing";
import { startTrialAction } from "./actions";
import { RegisterFields } from "./register-fields";
import { INITIAL_PRICING_STATE } from "./state";

export function RegisterForm({ initialPlan }: { initialPlan?: PlanKey }) {
  const [state, action, pending] = useActionState(startTrialAction, INITIAL_PRICING_STATE);
  return <RegisterFields state={state} pending={pending} initialPlan={initialPlan} action={action} />;
}
