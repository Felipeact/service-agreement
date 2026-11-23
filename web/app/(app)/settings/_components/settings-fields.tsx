"use client";

import Link from "next/link";
import { useState, type FormEvent, type MouseEvent, type ReactNode } from "react";
import type { OrgSettingsErrors, OrgSettingsInput } from "@/domain/org-settings";
import type { UseFormRegister } from "react-hook-form";
import { PROVINCES } from "@/domain/org-settings";
import { formatTermDate } from "@/domain/agreement/term";
import { isAccent } from "@/domain/portal";
import { CheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icons";
import { Select } from "@/components/ui/select";
import { TextInput } from "@/components/ui/text-input";
import { LogoField } from "@/components/settings/logo-field";
import type { LogoUploadAnswer } from "@/app/logo-upload";
import type { SettingsFormState } from "@/components/settings/state";

type SettingsFieldsProps = {
  values: OrgSettingsInput;
  state: SettingsFormState;
  pending: boolean;
  readOnly: boolean;
  /** The form action; absent in tests that only render markup. */
  action?: (formData: FormData) => void;
  /** The browser-side form (React Hook Form); without it the fields are plain and post through `action`. */
  onSubmit?: (event: FormEvent<HTMLFormElement>) => void;
  register?: UseFormRegister<OrgSettingsInput>;
  /** Messages from the browser's check; they win over the server's. */
  liveErrors?: OrgSettingsErrors;
  /** The org has a subscription the member may manage, so the menu lists Billing under Members. */
  billingNav?: boolean;
  /** `prepareLogoUpload`: the server half of a logo upload (tenant-logo). */
  prepareLogo?: (file: { type: string; size: number }) => Promise<LogoUploadAnswer>;
  /** Where the form starts: only a test passes it. */
  initialUploading?: boolean;
};

const MESSAGES = {
  forbidden: "You don't have permission to change company settings.",
  unavailable: "We couldn't save your settings. Try again.",
};

const ACCENT_CHOICES = ["#2563eb", "#0f766e", "#b45309", "#7c3aed", "#be123c"] as const;

const SECTIONS = [
  { id: "company", label: "Company" },
  { id: "terms", label: "Default terms" },
  { id: "renewal", label: "Renewal" },
] as const;

/** One tab: the section shown is tinted; the others are plain. 44px tall on a phone. */
function menuClass(active: boolean): string {
  return `flex h-11 items-center gap-1.5 rounded-control px-3 text-[13px] font-medium whitespace-nowrap transition-colors duration-150 lg:h-9 ${active ? "bg-action-tint font-semibold text-action" : "text-ink-nav hover:bg-board hover:text-ink"}`;
}

/** The fields each section holds, so a tab can say it has something to fix. */
const SECTION_FIELDS: Record<(typeof SECTIONS)[number]["id"], readonly (keyof OrgSettingsInput)[]> = {
  company: ["legalName", "phone", "address", "itemSingular", "itemPlural", "accentColor", "logoPath"],
  terms: ["repairDiscountPct", "cpiCapPct", "cancellationNoticeDays", "paymentDays", "proposalValidityDays", "governingProvince", "taxNote"],
  renewal: ["defaultTermMonths", "renewalNoticeDays", "cpiRenegotiationThresholdPct", "renewalCpiPct", "renewalCpiAsOf"],
};

/** A section of the form: its fields. The heading and the line under it are for screen readers; the tab already says where you are. */
function Card({ id, title, text, children, shown }: { id: string; title: string; text: string; children: ReactNode; shown: boolean }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className={`scroll-mt-24 flex-col gap-5 ${shown ? "flex" : "hidden"}`}>
      <div className="sr-only">
        <h2 id={`${id}-title`}>{title}</h2>
        <p>{text}</p>
      </div>
      {children}
    </section>
  );
}

/** The company profile and default-terms form. Presentational: the caller owns the state. */
export function SettingsFields({ values, state, pending, readOnly, action, onSubmit, register, liveErrors, billingNav = false, prepareLogo, initialUploading = false }: SettingsFieldsProps) {
  const [uploading, setUploading] = useState(initialUploading);
  const errors: OrgSettingsErrors = { ...(state.status === "invalid" ? state.errors : {}), ...liveErrors };
  const field = (name: keyof OrgSettingsInput) => (register ? register(name) : { name });
  const [active, setActive] = useState<string>("company");
  const choose = (id: string, event: MouseEvent) => {
    event.preventDefault();
    setActive(id);
  };
  const hasProblem = (id: (typeof SECTIONS)[number]["id"]) => SECTION_FIELDS[id].some((name) => Boolean(errors[name]));

  const [brand, setBrand] = useState({ name: values.legalName, accent: values.accentColor, address: values.address, phone: values.phone });

  /** Sets the hidden hex field the form saves, the way typing in it would. */
  function chooseAccent(color: string) {
    const input = document.getElementById("accentColor") as HTMLInputElement | null;
    if (!input) return;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, color);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    setBrand((was) => ({ ...was, accent: color }));
  }

  function onInput(event: FormEvent<HTMLFormElement>) {
    const data = new FormData(event.currentTarget);
    const read = (name: string) => String(data.get(name) ?? "");
    setBrand({ name: read("legalName"), accent: read("accentColor"), address: read("address"), phone: read("phone") });
  }

  const text = (name: keyof OrgSettingsInput, label: string, extra: { inputMode?: "decimal" | "numeric" | "tel" } = {}) => (
    <TextInput id={name} label={label} defaultValue={values[name]} error={errors[name]} readOnly={readOnly} {...extra} {...field(name)} />
  );

  return (
    <form action={action} onSubmit={onSubmit} onInput={onInput} noValidate className="flex flex-col gap-6">
      <nav aria-label="Settings sections" className="relative -mx-4 flex items-center gap-1 overflow-x-auto px-4 md:mx-0 md:px-0">
        {SECTIONS.map((section) => (
          <a key={section.id} href={`#${section.id}`} onClick={(event) => choose(section.id, event)} className={menuClass(active === section.id)} aria-current={active === section.id ? "location" : undefined}>
            {section.label}
            {hasProblem(section.id) && (
              <span className="inline-flex items-center">
                <span aria-hidden="true" className="size-2 rounded-full bg-danger" />
                <span className="sr-only"> has a field to fix</span>
              </span>
            )}
          </a>
        ))}
        <Link href="/members" className={`ml-auto justify-between ${menuClass(false)}`}>
          Members
          <Icon name="chevron" className="size-3.5" />
        </Link>
        {billingNav && (
          <Link href="/settings/billing" className={`justify-between ${menuClass(false)}`}>
            Billing
            <Icon name="chevron" className="size-3.5" />
          </Link>
        )}
      </nav>

      <div className="flex flex-col rounded-panel border border-hairline bg-surface shadow-card">
      <div className="flex flex-col gap-5 p-5 sm:p-6">
        <Card shown={active === "company"} id="company" title="Company" text="Your legal details and the colour customers see on their agreements.">
          <LogoField key={values.logoPath ?? ""} storedPath={values.logoPath ?? ""} readOnly={readOnly} prepare={prepareLogo} onUploadingChange={setUploading} serverError={errors.logoPath} />
          <div className="grid gap-4 sm:grid-cols-2">
            {text("legalName", "Legal name")}
            {text("phone", "Phone", { inputMode: "tel" })}
            <div className="sm:col-span-2">{text("address", "Address")}</div>
            <div className="flex flex-col gap-1.5">
              {text("itemSingular", "Item, singular")}
              <p className="text-[12px] text-ink-2">What you call one thing you service, as customers read it: &ldquo;station&rdquo;, or &ldquo;equipment&rdquo; for both.</p>
            </div>
            {text("itemPlural", "Item, plural")}
            <fieldset className="flex flex-col gap-2 sm:col-span-2">
              <legend className="mb-2 text-[13px] font-medium">Accent colour</legend>
              <div className="flex flex-wrap gap-2">
                {ACCENT_CHOICES.map((color) => {
                  const picked = brand.accent.trim().toLowerCase() === color;
                  return (
                    <button
                      key={color}
                      type="button"
                      disabled={readOnly}
                      aria-pressed={picked}
                      aria-label={`Accent colour ${color}`}
                      onClick={() => chooseAccent(color)}
                      style={{ background: color }}
                      className="flex size-11 items-center justify-center rounded-full ring-2 ring-transparent transition-shadow aria-pressed:ring-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action disabled:opacity-60"
                    >
                      {picked && <CheckIcon aria-hidden="true" className="size-5 text-surface" />}
                    </button>
                  );
                })}
                {isAccent(brand.accent.trim()) && !ACCENT_CHOICES.includes(brand.accent.trim().toLowerCase() as (typeof ACCENT_CHOICES)[number]) && (
                  <span aria-hidden="true" data-accent-swatch style={{ background: brand.accent.trim() }} className="flex size-11 items-center justify-center rounded-full ring-2 ring-ink">
                    <CheckIcon className="size-5 text-surface" />
                  </span>
                )}
              </div>
              <div className="sr-only">{text("accentColor", "Accent colour")}</div>
              {errors.accentColor && <p className="text-[12px] font-medium text-danger">{errors.accentColor}</p>}
              <p className="text-[12px] text-ink-2">Customers see this colour on the review page, signing page and PDF.</p>
            </fieldset>
          </div>
        </Card>

        <Card shown={active === "terms"} id="terms" title="Default terms" text="What a new agreement starts with. Each one can be changed on the agreement itself.">
          <div className="grid gap-4 sm:grid-cols-2">
            {text("repairDiscountPct", "Repair discount (%)", { inputMode: "decimal" })}
            {text("cpiCapPct", "CPI cap (%)", { inputMode: "decimal" })}
            {text("cancellationNoticeDays", "Cancellation notice (days)", { inputMode: "numeric" })}
            {text("paymentDays", "Payment terms (days)", { inputMode: "numeric" })}
            {text("proposalValidityDays", "Proposals valid for (days)", { inputMode: "numeric" })}
            <Select
              id="governingProvince"
              label="Governing province"
              defaultValue={values.governingProvince}
              error={errors.governingProvince}
              disabled={readOnly}
              {...field("governingProvince")}
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
        </Card>

        <Card shown={active === "renewal"} id="renewal" title="Renewal" text="How long a term runs, when to warn a customer, and the price index renewals follow.">
          <div className="grid gap-4 sm:grid-cols-2">
            {text("defaultTermMonths", "Default term (months)", { inputMode: "numeric" })}
            {text("renewalNoticeDays", "Renewal notice (days)", { inputMode: "numeric" })}
            {text("cpiRenegotiationThresholdPct", "CPI renegotiation threshold (%)", { inputMode: "decimal" })}
          </div>
          {readOnly ? (
            <dl className="grid gap-4 text-[13px] sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <dt className="font-medium text-ink">CPI for renewals</dt>
                <dd className="text-ink-2">{values.renewalCpiPct === "" ? "Not set" : `${values.renewalCpiPct}%`}</dd>
              </div>
              <div className="flex flex-col gap-1.5">
                <dt className="font-medium text-ink">As of</dt>
                <dd className="text-ink-2">{values.renewalCpiAsOf === "" ? "Not set" : formatTermDate(values.renewalCpiAsOf)}</dd>
              </div>
            </dl>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {text("renewalCpiPct", "CPI for renewals", { inputMode: "decimal" })}
              <TextInput
                id="renewalCpiAsOf"
                label="As of"
                type="date"
                defaultValue={values.renewalCpiAsOf}
                error={errors.renewalCpiAsOf}
                {...field("renewalCpiAsOf")}
              />
            </div>
          )}
        </Card>

      </div>
        {readOnly ? (
          <p className="border-t border-hairline bg-ground/60 px-5 py-4 text-[13px] text-ink-2 sm:px-6">Only owners and admins can edit company settings.</p>
        ) : (
          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-hairline bg-ground/60 px-5 py-4 sm:px-6">
            {state.status === "saved" && (
              <p role="status" className="mr-auto text-[13px] font-medium text-ink">
                Settings saved
              </p>
            )}
            {(state.status === "forbidden" || state.status === "unavailable") && (
              <p role="alert" className="mr-auto text-[13px] font-medium text-danger">
                {MESSAGES[state.status]}
              </p>
            )}
            <Button type="submit" variant="primary" disabled={pending || uploading}>
              {pending ? "Saving…" : uploading ? "Uploading logo" : "Save changes"}
            </Button>
          </div>
        )}
      </div>
    </form>
  );
}
