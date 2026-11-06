import { Suspense } from "react";
import { NewAgreementDialog } from "@/components/agreements/new-agreement-dialog";
import { ImportBanner } from "@/components/imports/import-banner";
import { Button } from "@/components/ui/button";
import { getContainer } from "@/composition";
import { confirmImportAction, extractImportAction, readImportAction, startImportAction } from "./import-actions";
import { startAgreementAction } from "./new-agreement-actions";

/** What the dialog needs: the customers and sites it offers, and the actions it calls. */
async function dialogProps() {
  const { listCustomers, listActiveSites } = await getContainer();
  const [customers, sites] = await Promise.all([listCustomers(), listActiveSites()]);
  return {
    customers: customers.filter((customer) => customer.active).map(({ id, name }) => ({ id, name })),
    sites,
    actions: {
      start: startAgreementAction,
      startImport: startImportAction,
      confirmImport: confirmImportAction,
      readImport: readImportAction,
      extractImport: extractImportAction,
    },
  };
}

async function Dialog() {
  return <NewAgreementDialog {...await dialogProps()} />;
}

async function Banner() {
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
