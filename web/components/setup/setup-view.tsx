"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { OrgSettings } from "@/application/ports";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { TextInput } from "@/components/ui/text-input";
import { PROVINCES, PROVINCE_NAMES, type ItemWords } from "@/domain/org-settings";
import type { SetupCatalogGroup } from "@/domain/org-settings/setup";
import { toSetupInput, type SetupFormState } from "./state";

type SetupViewProps = {
  settings: OrgSettings;
  groups: SetupCatalogGroup[];
  words: ItemWords;
  action: (state: SetupFormState, formData: FormData) => Promise<SetupFormState>;
  /** Where the form starts; only a test passes it. */
  initialState?: SetupFormState;
};

const IDLE: SetupFormState = { status: "idle" };

const MESSAGES = {
  forbidden: "You don't have permission to change this.",
  unavailable: "We couldn't save your details. Try again.",
};

const CARD = "flex flex-col gap-4 rounded-panel border border-hairline bg-surface p-5 shadow-card sm:p-6";

/** The read-only review of what the starter catalog gave the org: no control here edits a type. */
export function CatalogReview({ groups, words }: { groups: SetupCatalogGroup[]; words: ItemWords }) {
  if (groups.length === 0) {
    return (
      <section aria-labelledby="catalog-title" className={CARD}>
        <h2 id="catalog-title" className="font-display text-[18px] font-semibold tracking-tight">
          What we set up
        </h2>
        <p className="text-[13px] font-medium text-ink">No types yet</p>
        <p className="text-[13px] text-ink-2">
          Your {words.plural} will appear here once your catalog is set up.
        </p>
      </section>
    );
  }
  return (
    <section aria-labelledby="catalog-title" className={CARD}>
      <div className="flex flex-col gap-1">
        <h2 id="catalog-title" className="font-display text-[18px] font-semibold tracking-tight">
          What we set up
        </h2>
        <p className="text-[13px] text-ink-2">Your starter catalog, with a checklist for each type.</p>
      </div>
      {groups.map((group) => (
        <div key={group.pack ?? "added"} className="flex flex-col gap-2">
          <p className="text-[13px] font-semibold text-ink">
            {group.label} <span className="font-normal text-ink-2">· {group.countText}</span>
          </p>
          <ul className="flex flex-wrap gap-1.5">
            {group.names.map((name) => (
              <li key={name} className="rounded-control bg-board px-2.5 py-1 text-[12px] text-ink-2">
                {name}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

/** The first-login setup page body: confirm the company profile, see the catalog, continue or skip. */
export function SetupView({ settings, groups, words, action, initialState = IDLE }: SetupViewProps) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const values = state.status === "idle" ? toSetupInput(settings) : state.values;
  const errors = state.status === "invalid" ? state.errors : {};

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-[26px] font-semibold tracking-tight">Set up your workspace</h1>
        <p className="text-[14px] text-ink-2">
          Confirm how customers see your company. You can change any of this later in{" "}
          <Link href="/settings" className="inline-block py-3.5 -my-3.5 font-semibold text-action hover:underline lg:py-0 lg:my-0">
            Settings
          </Link>
          .
        </p>
      </header>

      <form action={formAction} noValidate className="flex flex-col gap-6">
        <section aria-labelledby="profile-title" className={CARD}>
          <h2 id="profile-title" className="font-display text-[18px] font-semibold tracking-tight">
            Company
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput id="legalName" name="legalName" label="Legal name" defaultValue={values.legalName} error={errors.legalName} />
            <TextInput id="phone" name="phone" label="Phone" inputMode="tel" defaultValue={values.phone} error={errors.phone} />
            <div className="sm:col-span-2">
              <TextInput id="address" name="address" label="Address" defaultValue={values.address} error={errors.address} />
            </div>
            <Select key={values.governingProvince} id="governingProvince" name="governingProvince" label="Province or territory" defaultValue={values.governingProvince} error={errors.governingProvince}>
              <option value="">Choose one</option>
              {PROVINCES.map((code) => (
                <option key={code} value={code}>
                  {PROVINCE_NAMES[code].replace(/^the /, "")}
                </option>
              ))}
            </Select>
            <TextInput id="accentColor" name="accentColor" label="Accent colour" placeholder="#1f6f8b" defaultValue={values.accentColor} error={errors.accentColor} />
            <TextInput id="itemSingular" name="itemSingular" label="Item, singular" defaultValue={values.itemSingular} error={errors.itemSingular} />
            <TextInput id="itemPlural" name="itemPlural" label="Item, plural" defaultValue={values.itemPlural} error={errors.itemPlural} />
            <p className="text-[13px] text-ink-2 sm:col-span-2">
              What you call the things you service, as customers read it, for example &ldquo;station&rdquo; and &ldquo;stations&rdquo;. Use one word for both if it has no plural.
            </p>
          </div>
        </section>

        <CatalogReview groups={groups} words={words} />

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" name="intent" value="save" variant="primary" disabled={pending}>
            {pending ? "Saving…" : "Continue"}
          </Button>
          <Button type="submit" name="intent" value="skip" variant="secondary" disabled={pending}>
            Skip for now
          </Button>
          {(state.status === "forbidden" || state.status === "unavailable") && (
            <p role="alert" className="text-[13px] font-medium text-danger">
              {MESSAGES[state.status]}
            </p>
          )}
        </div>
      </form>
    </div>
  );
}
