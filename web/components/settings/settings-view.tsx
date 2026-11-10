"use client";

import { useActionState } from "react";
import type { MemberRole, OrgSettings } from "@/application/ports";
import { PageHeader } from "@/components/shell/page-header";
import { EmptyPanel } from "@/components/ui/empty-panel";
import type { BillingSectionView } from "@/domain/billing/portal";
import { BillingSection, type BillingFormState } from "./billing-section";
import { SettingsFields } from "./settings-fields";
import { canEditSettings, toInput, type SettingsFormState } from "./state";

type SettingsViewProps = {
  /** `null` when the org has no settings row. */
  settings: OrgSettings | null;
  role: MemberRole;
  action: (state: SettingsFormState, formData: FormData) => Promise<SettingsFormState>;
  /** The Billing section; left out, none is shown (billing-portal). */
  billing?: BillingSectionView;
  billingAction?: (state: BillingFormState) => Promise<BillingFormState>;
};

const IDLE: SettingsFormState = { status: "idle" };

function SettingsForm({ settings, role, action }: SettingsViewProps & { settings: OrgSettings }) {
  const [state, formAction, pending] = useActionState(action, IDLE);
  const values = state.status === "idle" ? toInput(settings) : state.values;
  return <SettingsFields values={values} state={state} pending={pending} readOnly={!canEditSettings(role)} action={formAction} />;
}

/** The Settings page body. */
export function SettingsView(props: SettingsViewProps) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Settings" subtitle="Your company profile, the terms new agreements start with, and how renewals work." />
      {props.settings ? (
        <SettingsForm {...props} settings={props.settings} />
      ) : (
        <EmptyPanel title="Company settings have not been set up for this workspace." />
      )}
      {props.billing && props.billingAction && <BillingSection view={props.billing} action={props.billingAction} />}
    </div>
  );
}
