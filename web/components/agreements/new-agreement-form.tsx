"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { SiteOption } from "@/application/ports";
import { messageFor, type CreateAgreementState } from "@/components/agreements/state";
import { PlanLimitAlert } from "@/components/billing/plan-limit-alert";
import { Button } from "@/components/ui/button";
import { EmptyPanel } from "@/components/ui/empty-panel";
import { LinkButton } from "@/components/ui/link-button";
import { Select } from "@/components/ui/select";

/** The template Use template chose: the new agreement is pinned to this version and starts with its preset lines. */
export type ChosenTemplate = { versionId: string; name: string };

type FormProps = {
  sites: SiteOption[];
  /** Named above the site choice when the agreement starts from a template (agreement-templates AC 24). */
  template?: Pick<ChosenTemplate, "name">;
  state: CreateAgreementState;
  pending: boolean;
  /** The form action; absent in tests that only render markup. */
  action?: (formData: FormData) => void;
};

/** Reads the chosen site and starts the agreement on it; the server answers, or redirects to the builder. */
export function submitSite(create: (siteId: string) => Promise<CreateAgreementState>, formData: FormData) {
  return create(String(formData.get("siteId") ?? ""));
}

/** The New agreement form: a site picker over the sites that can start one; a site already in progress is named with its link (agreements-page S2). */
export function NewAgreementFormView({ sites, template, state, pending, action }: FormProps) {
  const free = sites.filter((site) => !site.liveAgreement);
  const busy = sites.filter((site) => site.liveAgreement);
  const customers = [...new Set(free.map((site) => site.customer))];
  const message = state.status === "open_exists" || state.status === "plan_limit" ? null : messageFor(state.status);

  return (
    <div className="flex flex-col gap-4">
      {template && (
        <p className="flex flex-wrap items-center gap-x-3 text-[13px] font-medium text-ink">
          {`From template: ${template.name}`}
          <Link href="/templates" className="inline-flex min-h-11 items-center font-medium text-action lg:min-h-0">
            Choose another
          </Link>
        </p>
      )}
      {free.length === 0 ? (
        <EmptyPanel title="No site can start an agreement." text="Every active site already has an agreement in progress, or no site has been added yet.">
          <LinkButton href="/customers">Go to Customers</LinkButton>
        </EmptyPanel>
      ) : (
        <form action={action} className="flex max-w-md flex-col gap-3">
          <Select id="siteId" name="siteId" label="Site" defaultValue="" required>
            <option value="" disabled>
              Choose a site
            </option>
            {customers.map((customer) => (
              <optgroup key={customer} label={customer}>
                {free
                  .filter((site) => site.customer === customer)
                  .map((site) => (
                    <option key={site.id} value={site.id}>
                      {site.name}
                    </option>
                  ))}
              </optgroup>
            ))}
          </Select>
          <div>
            <Button type="submit" variant="primary" disabled={pending}>
              {pending ? "Creating…" : "Create agreement"}
            </Button>
          </div>
        </form>
      )}
      {state.status === "open_exists" && (
        <p role="alert" className="text-[13px] font-medium text-ink">
          {`${state.number} is already in progress for this site.`}{" "}
          <Link href={`/agreements/${state.agreementId}`} className="inline-flex min-h-11 items-center text-action lg:min-h-0">
            {`Open ${state.number}`}
          </Link>
        </p>
      )}
      {state.status === "plan_limit" && <PlanLimitAlert message={state.message} billingHref={state.billingHref} />}
      {message && (
        <p role="alert" className="text-[13px] font-medium text-danger">
          {message}
        </p>
      )}
      {busy.length > 0 && (
        <section aria-label="Sites with an agreement in progress" className="flex flex-col gap-1">
          <h2 className="text-[13px] font-semibold text-ink-2">Already in progress</h2>
          <ul className="flex flex-col text-[13px]">
            {busy.map((site) => (
              <li key={site.id} className="flex flex-wrap items-center gap-x-2">
                <span>{`${site.name} (${site.customer})`}</span>
                <Link href={`/agreements/${site.liveAgreement!.id}`} className="inline-flex min-h-11 items-center text-action lg:min-h-0">
                  {site.liveAgreement!.number}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

type FormCreate = (siteId: string, templateVersionId?: string) => Promise<CreateAgreementState>;

export function NewAgreementForm({ sites, create, template }: { sites: SiteOption[]; create: FormCreate; template?: ChosenTemplate }) {
  // Without a template the action is called with the site alone, as it always was.
  const start = template ? (siteId: string) => create(siteId, template.versionId) : create;
  const [state, formAction, pending] = useActionState<CreateAgreementState, FormData>((_previous, formData) => submitSite(start, formData), {
    status: "idle",
  });
  return <NewAgreementFormView sites={sites} template={template} state={state} pending={pending} action={formAction} />;
}
