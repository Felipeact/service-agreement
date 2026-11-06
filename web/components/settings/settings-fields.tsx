"use client";

import Link from "next/link";
import { useState, type FormEvent, type ReactNode } from "react";
import type { OrgSettingsErrors, OrgSettingsInput } from "@/domain/org-settings";
import { PROVINCES } from "@/domain/org-settings";
import { formatTermDate } from "@/domain/agreement/term";
import { contrastText, isAccent } from "@/domain/portal";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icons";
import { initialsOf } from "@/components/ui/list-panel";
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

const SECTIONS = [
  { id: "company", label: "Company" },
  { id: "terms", label: "Default terms" },
  { id: "renewal", label: "Renewal" },
] as const;

/** A section of the form: a white card with a heading, a line saying what the section is for, and its fields. */
function Card({ id, title, text, children }: { id: string; title: string; text: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-24 flex flex-col gap-5 rounded-panel border border-hairline bg-surface p-5 shadow-card sm:p-6">
      <div className="flex flex-col gap-1">
        <h2 id={`${id}-title`} className="font-display text-[18px] font-semibold tracking-tight">
          {title}
        </h2>
        <p className="text-[13px] text-ink-2">{text}</p>
      </div>
      {children}
    </section>
  );
}

/** How the company will look to a customer: its tile in the accent colour, its name and its contact lines. Follows the form as it is typed. */
function BrandPreview({ name, accent, address, phone }: { name: string; accent: string; address: string; phone: string }) {
  const color = isAccent(accent.trim()) ? accent.trim() : null;
  return (
    <div className="flex items-center gap-4 rounded-control bg-ground p-4">
      <span
        aria-hidden="true"
        data-brand-tile
        style={color ? { backgroundColor: color, color: contrastText(color) } : undefined}
        className={`inline-flex size-14 shrink-0 items-center justify-center rounded-panel font-display text-[20px] font-semibold ${color ? "" : "bg-board text-ink-2"}`}
      >
        {initialsOf(name || "Your company")}
      </span>
      <div className="flex min-w-0 flex-col">
        <span className="truncate font-display text-[16px] font-semibold tracking-tight">{name.trim() || "Your company"}</span>
        <span className="truncate text-[12px] text-ink-2">{[address.trim(), phone.trim()].filter(Boolean).join(" · ") || "Address and phone appear here"}</span>
        <span className="pt-1 text-[12px] text-ink-2">How customers see you on the review page, agreements and emails.</span>
      </div>
    </div>
  );
}

/** The company profile and default-terms form. Presentational: the caller owns the state. */
export function SettingsFields({ values, state, pending, readOnly, action }: SettingsFieldsProps) {
  const errors: OrgSettingsErrors = state.status === "invalid" ? state.errors : {};
  const [brand, setBrand] = useState({ name: values.legalName, accent: values.accentColor, address: values.address, phone: values.phone });

  function onInput(event: FormEvent<HTMLFormElement>) {
    const data = new FormData(event.currentTarget);
    const read = (name: string) => String(data.get(name) ?? "");
    setBrand({ name: read("legalName"), accent: read("accentColor"), address: read("address"), phone: read("phone") });
  }

  const text = (name: keyof OrgSettingsInput, label: string, extra: { inputMode?: "decimal" | "numeric" | "tel" } = {}) => (
    <TextInput id={name} name={name} label={label} defaultValue={values[name]} error={errors[name]} readOnly={readOnly} {...extra} />
  );

  return (
    <form action={action} onInput={onInput} noValidate className="lg:grid lg:grid-cols-[180px_minmax(0,1fr)] lg:gap-8">
      <nav aria-label="Settings sections" className="sticky top-24 hidden self-start lg:flex lg:flex-col lg:gap-0.5">
        {SECTIONS.map((section) => (
          <a key={section.id} href={`#${section.id}`} className="flex h-9 items-center rounded-control px-3 text-[13px] font-medium text-ink-nav transition-colors duration-150 hover:bg-board hover:text-ink">
            {section.label}
          </a>
        ))}
        <Link href="/members" className="mt-2 flex h-9 items-center justify-between rounded-control px-3 text-[13px] font-medium text-action transition-colors duration-150 hover:bg-action-tint">
          Members
          <Icon name="chevron" className="size-3.5" />
        </Link>
      </nav>

      <div className="flex max-w-3xl flex-col gap-5">
        <Card id="company" title="Company" text="Your legal details and the colour customers see on their agreements.">
          <BrandPreview {...brand} />
          <div className="grid gap-4 sm:grid-cols-2">
            {text("legalName", "Legal name")}
            {text("phone", "Phone", { inputMode: "tel" })}
            <div className="sm:col-span-2">{text("address", "Address")}</div>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-end gap-2">
                <div className="min-w-0 flex-1">{text("accentColor", "Accent colour")}</div>
                <span
                  aria-hidden="true"
                  data-accent-swatch
                  style={isAccent(brand.accent.trim()) ? { backgroundColor: brand.accent.trim() } : undefined}
                  className="mb-0 size-11 shrink-0 rounded-control border border-field bg-board lg:size-[34px]"
                />
              </div>
            </div>
          </div>
        </Card>

        <Card id="terms" title="Default terms" text="What a new agreement starts with. Each one can be changed on the agreement itself.">
          <div className="grid gap-4 sm:grid-cols-2">
            {text("repairDiscountPct", "Repair discount (%)", { inputMode: "decimal" })}
            {text("cpiCapPct", "CPI cap (%)", { inputMode: "decimal" })}
            {text("cancellationNoticeDays", "Cancellation notice (days)", { inputMode: "numeric" })}
            {text("paymentDays", "Payment terms (days)", { inputMode: "numeric" })}
            {text("proposalValidityDays", "Proposals valid for (days)", { inputMode: "numeric" })}
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
        </Card>

        <Card id="renewal" title="Renewal" text="How long a term runs, when to warn a customer, and the price index renewals follow.">
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
                name="renewalCpiAsOf"
                label="As of"
                type="date"
                defaultValue={values.renewalCpiAsOf}
                error={errors.renewalCpiAsOf}
              />
            </div>
          )}
        </Card>

        {readOnly ? (
          <p className="rounded-control bg-board px-4 py-3 text-[13px] text-ink-2">Only owners and admins can edit company settings.</p>
        ) : (
          <div className="sticky bottom-4 z-[5] flex w-fit max-w-full flex-wrap items-center gap-3 rounded-panel border border-hairline bg-surface p-3 shadow-lift">
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
      </div>
    </form>
  );
}
