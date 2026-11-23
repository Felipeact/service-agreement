"use client";

import { useState } from "react";
import { PlusIcon, UploadIcon } from "lucide-react";
import { CUSTOMERS, SITES, TEMPLATES } from "./data";
import { Btn, Field, INPUT, btn, itemText, type BtnVariant } from "./kit";
import { Modal, Tabs, useFormCheck, useToast, required } from "./kit-client";

type Mode = "upload" | "pick" | "later";
const TYPES = ["Rooftop unit", "Boiler", "Exhaust fan", "Split system", "Backflow preventer"];

/** The New agreement dialog from every Pipeline, Agreements, Templates and Sites screen: pick customer, site and template, then bring the list in one of three ways. */
export function NewAgreementButton({ label = "New agreement", variant = "primary", className = "", iconOnly = false }: { label?: string; variant?: BtnVariant; className?: string; iconOnly?: boolean }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("upload");
  const [customer, setCustomer] = useState("");
  const [fileName, setFileName] = useState("");
  const toast = useToast();
  const form = useFormCheck({ customer: [required("a customer")], site: [required("a site")] }, () => {
    setOpen(false);
    toast.show("Agreement AG-1043 created");
  });
  const sites = SITES.filter((site) => !customer || site.customer === customer);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={btn(variant, className)}>
        <PlusIcon aria-hidden="true" />
        {iconOnly ? <span className="sr-only">{label}</span> : label}
      </button>
      {toast.node}
      <Modal open={open} onClose={() => { setOpen(false); form.clear(); }} title="New agreement" sub="Pick the customer and site, then bring in what is on site.">
        <form noValidate onSubmit={form.handleSubmit} className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Customer" error={form.errors.customer}>
              <select name="customer" value={customer} onChange={(event) => setCustomer(event.target.value)} aria-invalid={form.errors.customer ? true : undefined} className={INPUT}>
                <option value="">Choose a customer</option>
                {CUSTOMERS.filter((entry) => entry.active).map((entry) => <option key={entry.id}>{entry.name}</option>)}
              </select>
            </Field>
            <Field label="Site" error={form.errors.site}>
              <select name="site" aria-invalid={form.errors.site ? true : undefined} className={INPUT} defaultValue="">
                <option value="">Choose a site</option>
                {sites.map((site) => <option key={site.id} disabled={Boolean(site.live)}>{site.name}{site.live ? ` (live: ${site.live})` : ""}</option>)}
              </select>
            </Field>
            <Field label="Template" className="sm:col-span-2">
              <select name="template" className={INPUT}>
                {TEMPLATES.filter((entry) => entry.kind === "Agreement").map((entry) => <option key={entry.id}>{entry.name}</option>)}
              </select>
            </Field>
          </div>

          <Tabs
            label="How to add the list"
            value={mode}
            onChange={setMode}
            tabs={[{ key: "upload", label: "Upload a list" }, { key: "pick", label: "Pick by hand" }, { key: "later", label: "Add later" }]}
          />

          {mode === "upload" && (
            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-panel border border-dashed border-line-strong bg-ground/60 px-4 py-8 text-center transition-colors hover:border-action hover:bg-action-tint">
              <UploadIcon aria-hidden="true" className="size-6 text-action" />
              <span className="text-[14px] font-semibold">{fileName || itemText("Drop the customer's equipment list here")}</span>
              <span className="text-[12px] text-ink-2">Excel, CSV, Word or PDF, up to 10 MB. Optional: you can add it after.</span>
              <input type="file" accept=".xlsx,.csv,.docx,.pdf" className="sr-only" onChange={(event) => setFileName(event.target.files?.[0]?.name ?? "")} />
              <span className={btn("secondary", "pointer-events-none mt-1")}>Choose a file</span>
            </label>
          )}
          {mode === "pick" && (
            <fieldset className="grid gap-2 sm:grid-cols-2">
              <legend className="mb-2 text-[13px] font-medium">Types on site</legend>
              {TYPES.map((type) => (
                <label key={type} className="flex min-h-11 items-center gap-3 rounded-control border border-hairline px-3 text-[14px] has-[:checked]:border-action has-[:checked]:bg-action-tint">
                  <input type="checkbox" className="size-4 accent-[var(--color-action)]" />
                  {type}
                </label>
              ))}
            </fieldset>
          )}
          {mode === "later" && <p className="rounded-control bg-board px-4 py-3 text-[13px] text-ink-nav">The agreement starts empty. Add service lines whenever you have the list.</p>}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Btn onClick={() => setOpen(false)}>Cancel</Btn>
            <Btn type="submit" variant="primary">Create agreement</Btn>
          </div>
        </form>
      </Modal>
    </>
  );
}
