"use client";

import { useActionState } from "react";
import type { MemberRole, OrgSettings } from "@/application/ports";
import { PageHeader } from "@/components/shell/page-header";
import { EmptyPanel } from "@/components/ui/empty-panel";
import type { LogoUploadAnswer } from "@/app/logo-upload";
import { SettingsFields } from "./settings-fields";
import { canEditSettings, toInput, type SettingsFormState } from "./state";

type SettingsViewProps = {
  /** `null` when the org has no settings row. */
  settings: OrgSettings | null;
  role: MemberRole;
  action: (state: SettingsFormState, formData: FormData) => Promise<SettingsFormState>;
  /** The org has a subscription this member may manage: the menu lists Billing under Members (billing-page AC 25). */
  billingLink?: boolean;
  /** The org's stored logo key, empty for none. */
  logoPath?: string;
  /** `prepareLogoUpload`, for owners and admins. */
  prepareLogo?: (file: { type: string; size: number }) => Promise<LogoUploadAnswer>;
};

const IDLE: SettingsFormState = { status: "idle" };

function SettingsForm({ settings, role, action, billingNav, logoPath = "", prepareLogo }: SettingsViewProps & { settings: OrgSettings; billingNav: boolean }) {
  const [state, formAction, pending] = useActionState(action, IDLE);
  const values = state.status === "idle" ? { ...toInput(settings), logoPath } : state.values;
  return <SettingsFields values={values} state={state} pending={pending} readOnly={!canEditSettings(role)} action={formAction} billingNav={billingNav} prepareLogo={prepareLogo} />;
}

/** The Settings page body. */
export function SettingsView(props: SettingsViewProps) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Settings" subtitle="Your company profile, the terms new agreements start with, and how renewals work." />
      {props.settings ? (
        <SettingsForm {...props} settings={props.settings} billingNav={props.billingLink === true} />
      ) : (
        <EmptyPanel title="Company settings have not been set up for this workspace." />
      )}
    </div>
  );
}
