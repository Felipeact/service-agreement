import type { Metadata } from "next";
import { Suspense } from "react";
import { PageLoading } from "@/components/shell/page-loading";
import {
  addServiceLineAction,
  generateServiceLinesAction,
  removeServiceLineAction,
  reviseAgreementAction,
  saveTermAction,
  saveVersionNoteAction,
  sendAgreementAction,
  setScopeExclusionAction,
  setAgreementTemplateAction,
  updateServiceLineAction,
  withdrawAgreementAction,
} from "../../agreement-actions";
import { generateContractAction } from "../../contract-actions";
import { applyReviewAction, reviewAgreementAction } from "./_actions/review";
import { AgreementView, type AgreementActions } from "./_components/content";
import { loadAgreement } from "./_data-access/agreement";

export const metadata: Metadata = { title: "Agreement" };

type AgreementProps = { agreementId: string; searchParams: PageProps<"/agreements/[agreementId]">["searchParams"] };

/** Reads the agreement and `?version` at request time. */
export async function AgreementForRequest({ agreementId, searchParams }: AgreementProps) {
  const { role, canWrite, agreement, words, skippedCodes, recipient, templateChoices } = await loadAgreement(agreementId, await searchParams);

  const actions: AgreementActions | undefined = canWrite
    ? {
        add: addServiceLineAction.bind(null, agreementId),
        update: (lineId: string) => updateServiceLineAction.bind(null, lineId),
        remove: (lineId: string) => removeServiceLineAction.bind(null, lineId),
        revise: reviseAgreementAction.bind(null, agreementId),
        withdraw: withdrawAgreementAction.bind(null, agreementId),
        send: sendAgreementAction.bind(null, agreementId),
        setExcluded: setScopeExclusionAction.bind(null, agreementId),
        setTemplate: setAgreementTemplateAction.bind(null, agreementId),
        saveTerm: saveTermAction.bind(null, agreementId),
        saveNote: saveVersionNoteAction.bind(null, agreementId),
        generate: generateContractAction.bind(null, agreementId),
        generateLines: generateServiceLinesAction.bind(null, agreementId),
      }
    : undefined;

  const review = canWrite ? { review: reviewAgreementAction.bind(null, agreementId), apply: applyReviewAction.bind(null, agreementId) } : undefined;

  return (
    <AgreementView
      agreement={agreement}
      role={role}
      actions={actions}
      words={words}
      skippedCodes={skippedCodes}
      recipient={recipient}
      templateChoices={templateChoices}
      review={review}
    />
  );
}

export default async function AgreementPage({ params, searchParams }: PageProps<"/agreements/[agreementId]">) {
  const { agreementId } = await params;
  return (
    <Suspense fallback={<PageLoading title="Agreement" />}>
      <AgreementForRequest agreementId={agreementId} searchParams={searchParams} />
    </Suspense>
  );
}
