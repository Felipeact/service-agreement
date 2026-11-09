"use client";

import { useActionState, useState } from "react";
import type { PlanKey } from "@/domain/billing";
import { startTrialAction } from "./actions";
import { PricingFields } from "./pricing-fields";
import { INITIAL_PRICING_STATE } from "./state";

export function PricingForm() {
  const [state, action, pending] = useActionState(startTrialAction, INITIAL_PRICING_STATE);
  const [pressedPlan, setPressedPlan] = useState<PlanKey | null>(null);
  return <PricingFields state={state} pending={pending} pressedPlan={pressedPlan} action={action} onPress={setPressedPlan} />;
}
