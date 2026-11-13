"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import type { SiteOption } from "@/application/ports";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icons";
import { FileDropzone } from "@/components/ui/file-dropzone";
import { Select } from "@/components/ui/select";
import { TextInput } from "@/components/ui/text-input";
import { NoticeText, ProgressLine } from "./new-agreement-text";
import { useItemWords } from "@/components/shell/item-words";
import { formatFileSize, IMPORT_ACCEPT, validateImportFile } from "@/domain/imports";
import { itemText } from "@/domain/org-settings";
import { runExtraction, uploadFile, uploadMessage, type ConfirmState, type ExtractState, type ReadState, type StartState } from "@/components/imports/state";
import { presetLabel } from "@/domain/agreement/template";
import {
  FILE_HINT,
  firstCustomerChoice,
  LIST_FAILED,
  NEW_CHOICE,
  STANDARD_CHOICE,
  STANDARD_NAME,
  START_MESSAGES,
  startNotice,
  TEMPLATES_UNAVAILABLE,
  type DialogTemplate,
  type NewAgreementInput,
  type Phase,
  type StartAgreementState,
} from "./new-agreement-state";

type Customer = { id: string; name: string };

export type NewAgreementActions = {
  start: (input: NewAgreementInput) => Promise<StartAgreementState>;
  startImport: (siteId: string, formData: FormData) => Promise<StartState>;
  confirmImport: (jobId: string) => Promise<ConfirmState>;
  readImport: (jobId: string) => Promise<ReadState>;
  extractImport: (jobId: string) => Promise<ExtractState>;
  /** Adds a clean list to the site without a review; `needs_review` when something in it needs a person. */
  commitCleanImport?: (jobId: string) => Promise<{ status: string }>;
};

type Props = {
  customers: Customer[];
  /** Every active site, each with the agreement already live on it, if any. */
  sites: SiteOption[];
  actions: NewAgreementActions;
  /** The org's own templates, or `null` when they could not be listed (the dialog still starts a Standard agreement). */
  templates: DialogTemplate[] | null;
  /** The template version chosen when the dialog opens; Standard agreement when absent or not in `templates`. */
  initialTemplateVersionId?: string;
  /** Controlled mode, for a page that opens the dialog itself (the Imports drop banner); without it the dialog brings its own button. */
  open?: boolean;
  /** Called when the dialog closes, however it closed. */
  onClose?: () => void;
  /** A file already chosen or dropped, taken into the drop zone when the dialog opens. */
  initialFile?: File | null;
};

/**
 * "New agreement": a dialog that leads with the equipment list (drag it in or choose a file) and then asks who it is
 * for. The customer and the site can each be an existing one or a new one added on the spot. Submitting creates what is
 * missing, starts the draft, sends the list to the site and carries on to the list's review, so the estimator never
 * leaves the flow to add a customer or a site first.
 */
export function NewAgreementDialog({ customers, sites, actions, templates, initialTemplateVersionId, open: controlledOpen, onClose, initialFile }: Props) {
  const words = useItemWords();
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const offered = [...(templates ?? [])].sort((a, b) => a.name.localeCompare(b.name));
  const startingTemplate = offered.some((template) => template.versionId === initialTemplateVersionId) ? (initialTemplateVersionId as string) : STANDARD_CHOICE;
  const [template, setTemplate] = useState(startingTemplate);
  const [customer, setCustomer] = useState(firstCustomerChoice(customers));
  const [customerName, setCustomerName] = useState("");
  const [site, setSite] = useState("");
  const [siteName, setSiteName] = useState("");
  const [address, setAddress] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [notice, setNotice] = useState<{ text: string; href?: string; linkText?: string } | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [created, setCreated] = useState<{ customerId?: string; siteId?: string }>({});
  const [pending, startTransition] = useTransition();

  const newCustomer = customer === NEW_CHOICE;
  const customerSites = sites.filter((option) => option.customerId === customer);
  const freeSites = customerSites.filter((option) => !option.liveAgreement);
  const newSite = newCustomer || site === NEW_CHOICE;
  const busy = pending || phase !== "idle";
  const chosenTemplate = offered.find((option) => option.versionId === template);

  function open() {
    dialogRef.current?.showModal();
  }

  // A page that owns the open state drives the native dialog from it, taking in any file it already holds.
  useEffect(() => {
    if (controlledOpen === undefined) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (controlledOpen && !dialog.open) {
      setTemplate(startingTemplate);
      if (initialFile) chooseFile(initialFile);
      dialog.showModal();
    } else if (!controlledOpen && dialog.open) {
      dialog.close();
    }
    // chooseFile only reads state set here; the effect runs when the page opens or closes the dialog.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controlledOpen]);

  function close() {
    dialogRef.current?.close();
  }

  /** Leaves for another page with the dialog shut: a modal left open would stay on top of the page it navigates to. */
  function go(href: string) {
    const dialog = dialogRef.current;
    if (dialog?.open) dialog.close();
    router.push(href);
  }

  function reset() {
    setTemplate(startingTemplate);
    setCustomer(firstCustomerChoice(customers));
    setCustomerName("");
    setSite("");
    setSiteName("");
    setAddress("");
    setFile(null);
    setFileError(null);
    setErrors({});
    setNotice(null);
    setPhase("idle");
    setProgress(null);
    setCreated({});
    onClose?.();
  }

  function chooseCustomer(next: string) {
    setCustomer(next);
    setErrors((current) => ({ ...current, customer: undefined, customerName: undefined, site: undefined }));
    // A customer with no free site can only take a new one, so there is nothing to choose.
    const free = sites.filter((option) => option.customerId === next && !option.liveAgreement);
    setSite(next && next !== NEW_CHOICE && free.length === 0 ? NEW_CHOICE : "");
  }

  function chooseFile(next: File | null) {
    setFile(next);
    if (!next) return setFileError(null);
    const checked = validateImportFile({ name: next.name, size: next.size });
    setFileError(checked.ok ? null : checked.message);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (file && fileError) return;
    setErrors({});
    setNotice(null);

    startTransition(async () => {
      setPhase("creating");
      const input = {
        // A customer or site made on an earlier try is used as it is, never created twice.
        customer: created.customerId ?? customer,
        customerName,
        site: created.siteId ?? site,
        siteName,
        address,
        templateVersionId: template,
      };
      const started = await actions.start(input);

      if (started.status === "invalid") {
        setErrors(started.errors);
        return setPhase("idle");
      }
      if (started.status === "open_exists") {
        setNotice({ text: `${started.number} is already in progress for this site.`, href: `/agreements/${started.agreementId}`, linkText: `Open ${started.number}` });
        return setPhase("idle");
      }
      if (started.status === "plan_limit") {
        setNotice(startNotice(started));
        return setPhase("idle");
      }
      if (started.status !== "started") {
        // What an earlier try created stays, so a later refusal that carries no ids does not make the next try create it again.
        setCreated((earlier) => ({ customerId: started.customerId ?? earlier.customerId, siteId: started.siteId ?? earlier.siteId }));
        setNotice({ text: START_MESSAGES[started.status === "idle" ? "unavailable" : started.status] });
        return setPhase("idle");
      }

      const agreementHref = `/agreements/${started.agreementId}`;
      if (!file) return go(agreementHref);

      // The list goes to the site the agreement is on; then it is read and its equipment found.
      let jobId: string | null = null;
      setPhase("uploading");
      const sent = await uploadFile(file, {
        start: async (formData) => {
          const answer = await actions.startImport(started.siteId, formData);
          if (answer.status === "started") jobId = answer.jobId;
          return answer;
        },
        confirm: actions.confirmImport,
        read: actions.readImport,
        fetch: globalThis.fetch.bind(globalThis),
        onReading: () => setPhase("reading"),
      });

      if (sent.status !== "parsed" || !jobId) {
        setNotice({ text: uploadMessage(sent) ?? LIST_FAILED, href: agreementHref, linkText: "Open the agreement" });
        setPhase("idle");
        return setCreated({ siteId: started.siteId });
      }

      setPhase("extracting");
      const extracted = await runExtraction(jobId, { extract: actions.extractImport, onProgress: setProgress });
      // A list with nothing wrong goes straight to the agreement; the review opens only when something needs a person.
      if (extracted.status === "extracted" && actions.commitCleanImport) {
        const committed = await actions.commitCleanImport(jobId).catch(() => ({ status: "needs_review" }));
        if (committed.status === "committed") return go(agreementHref);
      }
      // Rows found go to the review grid; a list that could not be read through is finished from the site's import page.
      go(
        extracted.status === "extracted" ? `/imports/${jobId}?agreement=${started.agreementId}` : `/sites/${started.siteId}/import?agreement=${started.agreementId}`,
      );
    });
  }

  const submitLabel = busy ? "Working…" : file ? "Create agreement and read the list" : "Create agreement";

  return (
    <>
      {controlledOpen === undefined && (
        <Button variant="primary" onClick={open}>
          <Icon name="plus" className="size-4" />
          New agreement
        </Button>
      )}
      <dialog
        ref={dialogRef}
        aria-labelledby="new-agreement-title"
        onClose={reset}
        onCancel={(event) => busy && event.preventDefault()}
        onClick={(event) => event.target === dialogRef.current && !busy && close()}
        className="m-auto max-h-[calc(100dvh-1.5rem)] w-[min(34rem,calc(100vw-1.5rem))] overflow-y-auto rounded-[16px] bg-surface p-0 text-ink shadow-panel backdrop:bg-ink/40 backdrop:backdrop-blur-sm"
      >
        <form onSubmit={submit} noValidate className="flex flex-col gap-5 p-5 sm:p-7">
          <header className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <h2 id="new-agreement-title" className="font-display text-[22px] leading-tight font-semibold tracking-tight">
                New agreement
              </h2>
              <p className="text-[13px] text-ink-2">{itemText("Start with the customer's equipment list and the service scope is built from what is on site.", words)}</p>
            </div>
            <button
              type="button"
              aria-label="Close"
              onClick={close}
              disabled={busy}
              className="-mt-1 -mr-2 inline-flex size-11 shrink-0 items-center justify-center rounded-control text-ink-2 transition-colors duration-150 hover:bg-ground disabled:opacity-50"
            >
              <Icon name="close" />
            </button>
          </header>

          <FileDropzone
            id="newAgreementFile"
            label={itemText("Equipment list (optional)", words)}
            accept={IMPORT_ACCEPT}
            hint={FILE_HINT}
            file={file}
            sizeLabel={file ? formatFileSize(file.size) : undefined}
            error={fileError}
            disabled={busy}
            onFile={chooseFile}
          />

          <div className="flex flex-col gap-1.5">
            <Select
              id="newAgreementTemplate"
              label="Template"
              value={template}
              disabled={busy}
              error={errors.templateVersionId}
              onChange={(event) => {
                setTemplate(event.target.value);
                setErrors((current) => ({ ...current, templateVersionId: undefined }));
                setNotice(null);
              }}
            >
              <option value={STANDARD_CHOICE}>{STANDARD_NAME}</option>
              {offered.map((option) => (
                <option key={option.versionId} value={option.versionId}>
                  {option.name}
                </option>
              ))}
            </Select>
            {templates === null ? (
              <p className="text-[12px] text-ink-2">{TEMPLATES_UNAVAILABLE}</p>
            ) : (
              <p className="text-[12px] text-ink-2">
                {chosenTemplate?.description && <span className="block">{chosenTemplate.description}</span>}
                <span className="block font-medium">{presetLabel(chosenTemplate?.presetLines ?? 0, chosenTemplate?.termMonths ?? null)}</span>
              </p>
            )}
          </div>

          <fieldset disabled={busy} className="flex flex-col gap-4 border-0 p-0">
            <legend className="pb-1 font-display text-[15px] font-semibold tracking-tight">Who is it for?</legend>
            <Select
              id="newAgreementCustomer"
              label="Customer"
              value={customer}
              error={errors.customer}
              onChange={(event) => chooseCustomer(event.target.value)}
            >
              <option value="" disabled>
                Choose a customer
              </option>
              {customers.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
              <option value={NEW_CHOICE}>+ Add a new customer…</option>
            </Select>

            {newCustomer && (
              <TextInput
                id="newAgreementCustomerName"
                label="New customer name"
                value={customerName}
                autoComplete="organization"
                error={errors.customerName}
                onChange={(event) => setCustomerName(event.target.value)}
              />
            )}

            {customer && !newCustomer && (
              <Select id="newAgreementSite" label="Site" value={site} error={errors.site} onChange={(event) => setSite(event.target.value)}>
                <option value="" disabled>
                  Choose a site
                </option>
                {freeSites.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
                {customerSites
                  .filter((option) => option.liveAgreement)
                  .map((option) => (
                    <option key={option.id} value={option.id} disabled>
                      {`${option.name} (${option.liveAgreement!.number} in progress)`}
                    </option>
                  ))}
                <option value={NEW_CHOICE}>+ Add a new site…</option>
              </Select>
            )}

            {customer && newSite && (
              <div className="flex flex-col gap-4">
                <TextInput
                  id="newAgreementSiteName"
                  label="New site name"
                  value={siteName}
                  error={errors.siteName}
                  onChange={(event) => setSiteName(event.target.value)}
                />
                <TextInput
                  id="newAgreementAddress"
                  label="Address (optional)"
                  value={address}
                  autoComplete="street-address"
                  error={errors.address}
                  onChange={(event) => setAddress(event.target.value)}
                />
              </div>
            )}
          </fieldset>

          <div role="status" aria-live="polite" className="min-h-5 text-[13px] text-ink-2">
            <ProgressLine phase={phase} progress={progress} />
          </div>
          {notice && (
            <p role="alert" className="rounded-control bg-attention-bg px-3 py-2.5 text-[13px] text-attention-fg">
              <NoticeText text={notice.text} />{" "}
              {notice.href && (
                <Link href={notice.href} className="inline-flex min-h-11 items-center font-semibold underline lg:min-h-0">
                  {notice.linkText}
                </Link>
              )}
            </p>
          )}

          <footer className="flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
            <Button onClick={close} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={busy || Boolean(file && fileError)}>
              {submitLabel}
            </Button>
          </footer>
        </form>
      </dialog>
    </>
  );
}
