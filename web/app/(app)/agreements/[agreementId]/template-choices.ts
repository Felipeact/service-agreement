import type { AgreementDetail, AgreementTemplateReader } from "@/application/ports";
import type { TemplateChoice } from "@/components/agreements/template-picker";

/** The templates a draft can switch to, or `undefined` when they cannot be read or none is pinned. The pinned version is always in the list. */
export async function templateChoicesOf(read: () => ReturnType<AgreementTemplateReader["list"]>, agreement: AgreementDetail): Promise<{ choices: TemplateChoice[]; selected: string } | undefined> {
  const listed = await read().catch(() => null);
  if (!listed || !listed.ok) return undefined;
  const choices = listed.templates.map(({ versionId, body }) => ({ versionId, name: body.name }));
  const pinned = agreement.templateVersionId ?? listed.templates.find((template) => template.system)?.versionId;
  if (pinned && agreement.template && !choices.some((choice) => choice.versionId === pinned)) choices.unshift({ versionId: pinned, name: agreement.template.name });
  return pinned ? { choices, selected: pinned } : undefined;
}
