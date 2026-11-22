"use client";

import type { MemberRole, OrgSettings } from "@/application/ports";
import type { OrgSettingsInput } from "@/domain/org-settings";
import { PageHeader } from "@/components/shell/page-header";
import { EmptyPanel } from "@/components/ui/empty-panel";
import type { LogoUploadAnswer } from "@/app/logo-upload";
import { companyDetailsReady, validateOrgSettings } from "@/domain/org-settings";
import { useRecordForm } from "@/components/records/use-record-form";
import { domainSchema, text } from "@/lib/forms/domain-schema";
import { SettingsFields } from "./settings-fields";
import { canEditSettings, toInput, type SettingsFormState } from "@/components/settings/state";

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

const FIELDS = [
  "legalName", "address", "phone", "accentColor", "repairDiscountPct", "cpiCapPct", "cancellationNoticeDays", "paymentDays", "governingProvince", "taxNote",
  "defaultTermMonths", "renewalNoticeDays", "cpiRenegotiationThresholdPct", "renewalCpiPct", "renewalCpiAsOf", "proposalValidityDays", "itemSingular", "itemPlural",
] as const;

/** Every settings field is text; the domain validator judges them, in the browser here and again on the server. */
const settingsSchema = domainSchema(Object.fromEntries(FIELDS.map((name) => [name, text()])) as Record<(typeof FIELDS)[number], ReturnType<typeof text>>, (input) =>
  validateOrgSettings(input),
);

function SettingsForm({ settings, role, action, billingNav, logoPath = "", prepareLogo }: SettingsViewProps & { settings: OrgSettings; billingNav: boolean }) {
  const initial = { ...toInput(settings), logoPath };
  const { state, pending, register, onSubmit, errors } = useRecordForm<OrgSettingsInput, SettingsFormState>({ schema: settingsSchema, initial, action });
  const values = state.status === "idle" ? initial : state.values;
  return (
    <SettingsFields values={values} state={state} pending={pending} readOnly={!canEditSettings(role)} onSubmit={onSubmit} register={register} liveErrors={errors} billingNav={billingNav} prepareLogo={prepareLogo} />
  );
}

/** The Settings page body. */
export function SettingsView(props: SettingsViewProps) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Settings" subtitle="Your company profile, the terms new agreements start with, and how renewals work." />
      {props.settings && !companyDetailsReady({ legalName: props.settings.legalName, address: props.settings.address, phone: props.settings.phone, confirmedAt: props.settings.companyConfirmedAt ?? null }).ready && (
        <div role="status" className="flex flex-col gap-1 rounded-panel border border-hairline bg-attention-bg px-4 py-3 text-[13px] text-attention-fg">
          <p className="font-semibold">Confirm your company details before you send agreements</p>
          <p>Your customer sees your legal name, address and phone on the review page, the emails and the PDF. Enter your own and save to confirm them; sample details are not accepted.</p>
        </div>
      )}
      {props.settings ? (
        <SettingsForm {...props} settings={props.settings} billingNav={props.billingLink === true} />
      ) : (
        <EmptyPanel title="Company settings have not been set up for this workspace." />
      )}
    </div>
  );
}
