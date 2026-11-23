import type { Metadata } from "next";
import { canUseTemplates, canWriteTemplates } from "./_components/state";
import { TemplatesView } from "./_components/content";
import { dialogProps } from "../new-agreement-launcher";
import { loadTemplates } from "./_data-access/templates";
import { archiveTemplateAction, customizeSystemTemplateAction, duplicateTemplateAction } from "./template-actions";

export const metadata: Metadata = { title: "Agreement templates" };

/** Every member sees the list; Use template and the card menu follow the member's role (template-editor-v2 AC 35). */
export async function TemplatesForRequest() {
  const { role, list, wording, now } = await loadTemplates();
  const templates = list.ok ? list.templates : null;
  // Use template opens the New agreement dialog over this page, so the dialog's customers, sites and actions are read for those who can start one.
  const dialog = canUseTemplates(role) ? await dialogProps(list) : undefined;
  return (
    <TemplatesView
      templates={templates}
      role={role}
      now={now}
      dialog={dialog}
      contractWording={wording.ok ? { own: wording.own } : undefined}
      actions={canWriteTemplates(role) ? { duplicate: duplicateTemplateAction, archive: archiveTemplateAction, customize: customizeSystemTemplateAction } : undefined}
    />
  );
}

export default async function TemplatesPage() {
  return <TemplatesForRequest />;
}
