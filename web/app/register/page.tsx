import type { Metadata } from "next";
import { Suspense } from "react";
import { PLAN_KEYS, intervalFromParam, type PlanKey } from "@/domain/billing";
import { Content } from "./_components/content";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Register" };

/** Reads `?plan=` and `?billing=annual` at request time (the pricing page's plan buttons carry it); the plain form is the prerendered fallback. */
export async function RegisterFormForRequest({ searchParams }: Pick<PageProps<"/register">, "searchParams">) {
  const { plan, billing } = await searchParams;
  const initialPlan = PLAN_KEYS.find((key) => key === plan) as PlanKey | undefined;
  return <RegisterForm initialPlan={initialPlan} initialInterval={intervalFromParam(billing)} />;
}

/**
 * Where a new business says what it does, before it pays (decision 6, onboarding step 1): its trades and a plan,
 * then Checkout. The page is the owner's mockup (docs/service_pacts_register); the form is the live one.
 */
export default function RegisterPage({ searchParams }: PageProps<"/register">) {
  return (
    <Content
      form={
        <Suspense fallback={<RegisterForm />}>
          <RegisterFormForRequest searchParams={searchParams} />
        </Suspense>
      }
    />
  );
}
