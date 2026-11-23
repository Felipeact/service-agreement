import type { AgreementDetail, AgreementTemplateReader } from "@/application/ports";
import type { TemplateChoice } from "./_components/template-choice";

/** The templates a draft can switch to, or `undefined` when they cannot be read or none is pinned. The pinned version is always in the list. */
export async function templateChoicesOf(read: () => ReturnType<AgreementTemplateReader["list"]>, agreement: AgreementDetail): Promise<{ choices: TemplateChoice[]; selected: string } | undefined> {
  const listed = await read().catch(() => null);
  if (!listed || !listed.ok) return undefined;
  // The built-in template is labelled: an org often keeps its own copy under the same name.
  const choices: TemplateChoice[] = listed.templates.map(({ versionId, body, system }) => ({ versionId, name: system ? `${body.name} (built in)` : body.name, ...(body.description ? { description: body.description } : {}) }));
  const pinned = agreement.templateVersionId ?? listed.templates.find((template) => template.system)?.versionId;
  if (pinned && agreement.template && !choices.some((choice) => choice.versionId === pinned)) choices.unshift({ versionId: pinned, name: `${agreement.template.name} (earlier version)` });
  return pinned ? { choices, selected: pinned } : undefined;
}
