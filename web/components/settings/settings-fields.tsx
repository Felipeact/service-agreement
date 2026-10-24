import type { OrgSettingsErrors, OrgSettingsInput } from "@/domain/org-settings";
import { PROVINCES } from "@/domain/org-settings";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { TextInput } from "@/components/ui/text-input";
import type { SettingsFormState } from "./state";

type SettingsFieldsProps = {
  values: OrgSettingsInput;
  state: SettingsFormState;
  pending: boolean;
  readOnly: boolean;
  /** The form action; absent in tests that only render markup. */
  action?: (formData: FormData) => void;
};

const MESSAGES = {
  forbidden: "You don't have permission to change company settings.",
  unavailable: "We couldn't save your settings. Try again.",
};

/** The company profile and default-terms form. Presentational: the caller owns the state. */
export function SettingsFields({ values, state, pending, readOnly, action }: SettingsFieldsProps) {
  const errors: OrgSettingsErrors = state.status === "invalid" ? state.errors : {};
  const text = (name: keyof OrgSettingsInput, label: string, extra: { inputMode?: "decimal" | "numeric" | "tel" } = {}) => (
    <TextInput
      id={name}
      name={name}
      label={label}
      defaultValue={values[name]}
      error={errors[name]}
      readOnly={readOnly}
      {...extra}
    />
  );

  return (
    <form action={action} noValidate className="flex max-w-3xl flex-col gap-6">
      <section className="flex flex-col gap-3">
        <h2 className="text-[14px] font-semibold">Company</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {text("legalName", "Legal name")}
          {text("phone", "Phone", { inputMode: "tel" })}
          <div className="sm:col-span-2">{text("address", "Address")}</div>
          {text("accentColor", "Accent colour")}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-[14px] font-semibold">Default terms</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {text("repairDiscountPct", "Repair discount (%)", { inputMode: "decimal" })}
          {text("cpiCapPct", "CPI cap (%)", { inputMode: "decimal" })}
          {text("cancellationNoticeDays", "Cancellation notice (days)", { inputMode: "numeric" })}
          {text("paymentDays", "Payment terms (days)", { inputMode: "numeric" })}
          <Select
            id="governingProvince"
            name="governingProvince"
            label="Governing province"
            defaultValue={values.governingProvince}
            error={errors.governingProvince}
            disabled={readOnly}
          >
            <option value="">Not set</option>
            {PROVINCES.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </Select>
          <div className="sm:col-span-2">{text("taxNote", "Tax note")}</div>
        </div>
      </section>

      {readOnly ? (
        <p className="text-[13px] text-ink-2">Only owners and admins can edit company settings.</p>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? "Saving…" : "Save changes"}
          </Button>
          {state.status === "saved" && (
            <p role="status" className="text-[13px] font-medium text-ink">
              Settings saved
            </p>
          )}
          {(state.status === "forbidden" || state.status === "unavailable") && (
            <p role="alert" className="text-[13px] font-medium text-danger">
              {MESSAGES[state.status]}
            </p>
          )}
        </div>
      )}
    </form>
  );
}
