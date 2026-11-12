import { Suspense } from "react";
import { NewAgreementDialog } from "@/components/agreements/new-agreement-dialog";
import type { TemplateListResult } from "@/application/use-cases/templates";
import type { DialogTemplate } from "@/components/agreements/new-agreement-state";
import { ImportBanner } from "@/components/imports/import-banner";
import { Button } from "@/components/ui/button";
import { getContainer } from "@/composition";
import { confirmImportAction, extractImportAction, readImportAction, startImportAction } from "./import-actions";
import { startAgreementAction } from "./new-agreement-actions";

/**
 * The org's own templates as the Template choice lists them. Standard agreement is the dialog's own first option, so the system
 * template is not passed; `null` when the list could not be read.
 */
export function dialogTemplates(listed: TemplateListResult): DialogTemplate[] | null {
  if (!listed.ok) return null;
  return listed.templates
    .filter((template) => !template.system)
    .map(({ versionId, body }) => ({
      versionId,
      name: body.name,
      description: body.description,
      presetLines: body.preset.lines.length,
      termMonths: body.preset.termMonths,
    }));
}

/** What the dialog needs: the customers and sites it offers, the templates it lists and the actions it calls. */
export async function dialogProps() {
  const { listCustomers, listActiveSites, listAgreementTemplates } = await getContainer();
  const [customers, sites, listed] = await Promise.all([listCustomers(), listActiveSites(), listAgreementTemplates()]);
  return {
    customers: customers.filter((customer) => customer.active).map(({ id, name }) => ({ id, name })),
    sites,
    templates: dialogTemplates(listed),
    actions: {
      start: startAgreementAction,
      startImport: startImportAction,
      confirmImport: confirmImportAction,
      readImport: readImportAction,
      extractImport: extractImportAction,
    },
  };
}

export async function Dialog() {
  return <NewAgreementDialog {...await dialogProps()} />;
}

export async function Banner() {
  return <ImportBanner {...await dialogProps()} />;
}

/** The drop banner at the top of the Imports page: a file dropped or chosen there opens the New agreement dialog with it. */
export function ImportBannerLauncher() {
  return (
    <Suspense fallback={<div aria-hidden="true" className="h-[92px] rounded-panel border-2 border-dashed border-hairline" />}>
      <Banner />
    </Suspense>
  );
}

/** The New agreement button for writers: it opens the dialog that starts an agreement and its equipment list. */
export function NewAgreementLauncher() {
  return (
    <Suspense
      fallback={
        <Button variant="primary" disabled>
          New agreement
        </Button>
      }
    >
      <Dialog />
    </Suspense>
  );
}
