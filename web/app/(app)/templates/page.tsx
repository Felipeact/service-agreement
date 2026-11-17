import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { canUseTemplates, canWriteTemplates } from "@/components/templates/state";
import { TemplatesView } from "@/components/templates/templates-view";
import { getContainer } from "@/composition";
import { dialogProps } from "../new-agreement-launcher";
import { archiveTemplateAction, customizeSystemTemplateAction, duplicateTemplateAction } from "./template-actions";

export const metadata: Metadata = { title: "Agreement templates" };

/** Every member sees the list; Use template and the card menu follow the member's role (template-editor-v2 AC 35). */
export async function TemplatesForRequest() {
  const { currentMember, listAgreementTemplates, ensureStarterTemplates, getContractWording, clock } = await getContainer();
  const member = await currentMember();
  if (member.status !== "member") redirect("/login");
  // Someone who can write templates and whose company has none is given the starters first; everyone else just reads.
  const [list, wording] = await Promise.all([canWriteTemplates(member.role) ? ensureStarterTemplates() : listAgreementTemplates(), getContractWording()]);
  const templates = list.ok ? list.templates : null;
  // Use template opens the New agreement dialog over this page, so the dialog's customers, sites and actions are read for those who can start one.
  const dialog = canUseTemplates(member.role) ? await dialogProps(list) : undefined;
  return (
    <TemplatesView
      templates={templates}
      role={member.role}
      now={clock.now()}
      dialog={dialog}
      contractWording={wording.ok ? { own: wording.own } : undefined}
      actions={canWriteTemplates(member.role) ? { duplicate: duplicateTemplateAction, archive: archiveTemplateAction, customize: customizeSystemTemplateAction } : undefined}
    />
  );
}

export default async function TemplatesPage() {
  return <TemplatesForRequest />;
}
