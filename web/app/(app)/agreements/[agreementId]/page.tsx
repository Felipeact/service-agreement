import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { AgreementView, type AgreementActions } from "@/components/agreements/agreement-view";
import { canWriteRecords } from "@/components/records/state";
import { PageLoading } from "@/components/shell/page-loading";
import { getContainer } from "@/composition";
import { skippedCodes } from "@/domain/agreement";
import { isUuid } from "@/domain/imports";
import {
  addServiceLineAction,
  reissueLinkAction,
  removeServiceLineAction,
  reviseAgreementAction,
  saveTermAction,
  saveVersionNoteAction,
  sendAgreementAction,
  updateServiceLineAction,
  withdrawAgreementAction,
} from "../../agreement-actions";
import { generateContractAction } from "../../contract-actions";

export const metadata: Metadata = { title: "Agreement" };

type AgreementProps = { agreementId: string; searchParams: PageProps<"/agreements/[agreementId]">["searchParams"] };

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** `?version=<n>` or `?compare=<n>` as a whole number, or none: anything else shows the current version, or no comparison (AC 18, 12). */
function versionOf(value: string | undefined): number | undefined {
  return value !== undefined && /^\d+$/.test(value) ? Number(value) : undefined;
}

/** Reads the agreement and `?version` at request time. */
export async function AgreementForRequest({ agreementId, searchParams }: AgreementProps) {
  if (!isUuid(agreementId)) notFound();
  const { currentMember, agreementReader, getItemWords, listAssetTypes } = await getContainer();
  const member = await currentMember();
  if (member.status !== "member") redirect("/login");
  const params = await searchParams;
  const [agreement, words] = await Promise.all([
    agreementReader.get(agreementId, versionOf(first(params.version)), versionOf(first(params.compare))),
    getItemWords(member.orgId),
  ]);
  if (!agreement) notFound();

  const actions: AgreementActions | undefined = canWriteRecords(member.role)
    ? {
        add: addServiceLineAction.bind(null, agreementId),
        update: (lineId: string) => updateServiceLineAction.bind(null, lineId),
        remove: (lineId: string) => removeServiceLineAction.bind(null, lineId),
        revise: reviseAgreementAction.bind(null, agreementId),
        withdraw: withdrawAgreementAction.bind(null, agreementId),
        send: sendAgreementAction.bind(null, agreementId),
        reissue: reissueLinkAction.bind(null, agreementId),
        saveTerm: saveTermAction.bind(null, agreementId),
        saveNote: saveVersionNoteAction.bind(null, agreementId),
        generate: generateContractAction.bind(null, agreementId),
      }
    : undefined;

  // Only a preset with lines can name a code the org lacks, so the types are read only then (agreement-templates AC 25).
  const skipped = agreement.template && agreement.template.preset.lines.length > 0 ? skippedCodes(agreement.template, (await listAssetTypes()).map((type) => type.code)) : [];

  return <AgreementView agreement={agreement} role={member.role} actions={actions} words={words} skippedCodes={skipped} />;
}

export default async function AgreementPage({ params, searchParams }: PageProps<"/agreements/[agreementId]">) {
  const { agreementId } = await params;
  return (
    <Suspense fallback={<PageLoading title="Agreement" />}>
      <AgreementForRequest agreementId={agreementId} searchParams={searchParams} />
    </Suspense>
  );
}
