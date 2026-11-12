import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { canUseTemplates, canWriteTemplates } from "@/components/templates/state";
import { TemplatesView } from "@/components/templates/templates-view";
import { getContainer } from "@/composition";
import { dialogProps } from "../new-agreement-launcher";
import { archiveTemplateAction, customizeSystemTemplateAction, duplicateTemplateAction } from "./template-actions";

export const metadata: Metadata = { title: "Agreement templates" };

type Params = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** Every member sees the list and the preview; `?selected=<templateId>` picks the card, else the first (agreement-templates AC 16, 17, 21, 22). */
export async function TemplatesForRequest({ params }: { params: Params }) {
  const { currentMember, listAgreementTemplates, listAssetTypes, getItemWords, clock } = await getContainer();
  const member = await currentMember();
  if (member.status !== "member") redirect("/login");
  const [list, types, words] = await Promise.all([listAgreementTemplates(), listAssetTypes(), getItemWords(member.orgId)]);
  const templates = list.ok ? list.templates : null;
  // Use template opens the New agreement dialog over this page, so the dialog's customers, sites and actions are read for those who can start one.
  const dialog = canUseTemplates(member.role) ? await dialogProps(list) : undefined;
  const asked = first(params.selected);
  const selectedId = templates?.find((template) => template.id === asked)?.id ?? templates?.[0]?.id ?? null;
  return (
    <TemplatesView
      templates={templates}
      selectedId={selectedId}
      role={member.role}
      typeNames={Object.fromEntries(types.map((type) => [type.code, type.name]))}
      now={clock.now()}
      words={words}
      dialog={dialog}
      actions={canWriteTemplates(member.role) ? { duplicate: duplicateTemplateAction, archive: archiveTemplateAction, customize: customizeSystemTemplateAction } : undefined}
    />
  );
}

export default async function TemplatesPage({ searchParams }: PageProps<"/templates">) {
  return <TemplatesForRequest params={await searchParams} />;
}
