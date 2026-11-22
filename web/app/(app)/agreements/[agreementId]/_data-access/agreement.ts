import { notFound, redirect } from "next/navigation";
import { canWriteRecords } from "@/components/records/state";
import { getContainer } from "@/composition";
import { skippedCodes } from "@/domain/agreement";
import { isUuid } from "@/domain/imports";
import { templateChoicesOf } from "../template-choices";

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** `?version=<n>` or `?compare=<n>` as a whole number, or none: anything else shows the current version, or no comparison (AC 18, 12). */
function versionOf(value: string | undefined): number | undefined {
  return value !== undefined && /^\d+$/.test(value) ? Number(value) : undefined;
}

/**
 * What the agreement page reads: the agreement at the asked version, the org's item words, the preset codes the org lacks,
 * and for a writer on a draft the contact to send to and the templates to switch between. Signed out goes to /login; a
 * malformed or foreign id is a 404.
 */
export async function loadAgreement(agreementId: string, query: Record<string, string | string[] | undefined>) {
  if (!isUuid(agreementId)) notFound();
  const { currentMember, agreementReader, getItemWords, listAssetTypes, agreementRecipient, readAgreementTemplates } = await getContainer();
  const member = await currentMember();
  if (member.status !== "member") redirect("/login");
  const [agreement, words] = await Promise.all([
    agreementReader.get(agreementId, versionOf(first(query.version)), versionOf(first(query.compare))),
    getItemWords(member.orgId),
  ]);
  if (!agreement) notFound();

  const canWrite = canWriteRecords(member.role);
  // Only a preset with lines can name a code the org lacks, so the types are read only then (agreement-templates AC 25).
  const skipped = agreement.template && agreement.template.preset.lines.length > 0 ? skippedCodes(agreement.template, (await listAssetTypes()).map((type) => type.code)) : [];
  const editableByWriter = canWrite && agreement.editable;
  const recipient = editableByWriter ? await agreementRecipient.get(agreementId).catch(() => null) : null;
  // A writer on a draft can switch the template: the org's own and the system one, with the pinned version kept in the list.
  const templateChoices = editableByWriter ? await templateChoicesOf(readAgreementTemplates, agreement) : undefined;
  return { role: member.role, canWrite, agreement, words, skippedCodes: skipped, recipient, templateChoices };
}
