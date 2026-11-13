import { copyName } from "@/domain/agreement";
import type { AgreementTemplateReader, AgreementTemplateStore, AgreementTemplateSummary, TemplateFailure } from "@/application/ports";

export type TemplateListResult = { ok: true; templates: AgreementTemplateSummary[] } | { ok: false; code: "unavailable" };

/**
 * What the Templates screen lists: the org's own non-archived agreement templates, or, while it has none, the system template as
 * the one choice (agreement-templates AC 17). The reader returns both because RLS shows both.
 */
export function makeListAgreementTemplates(reader: AgreementTemplateReader) {
  return async function listAgreementTemplates(): Promise<TemplateListResult> {
    const read = await reader.list();
    if (!read.ok) return read;
    const own = read.templates.filter((template) => !template.system);
    return { ok: true, templates: own.length > 0 ? own : read.templates.filter((template) => template.system) };
  };
}

export type DuplicateTemplateResult = { ok: true; templateId: string } | { ok: false; code: TemplateFailure };

/**
 * Saves a copy of a template's latest version as a new template named `<name> (copy)`, `(copy 2)` and so on until the name is free
 * among the org's templates (agreement-templates AC 19). The system template can be copied too: that is how an org starts its own;
 * with `asOwn` it is saved under its own name, "Standard agreement" (template-flow AC 14).
 */
export function makeDuplicateAgreementTemplate(reader: AgreementTemplateReader, store: AgreementTemplateStore) {
  return async function duplicateAgreementTemplate(templateId: string, options: { asOwn?: boolean } = {}): Promise<DuplicateTemplateResult> {
    const read = await reader.list();
    if (!read.ok) return read;
    const source = read.templates.find((template) => template.id === templateId);
    if (!source) return { ok: false, code: "not_found" };
    const taken = read.templates.filter((template) => !template.system).map((template) => template.body.name);
    // Customizing the system template makes it the org's own under the same name; only a clash falls back to the copy naming.
    const keepsName = options.asOwn === true && source.system && !taken.some((name) => name.trim().toLowerCase() === source.body.name.trim().toLowerCase());
    const saved = await store.save(null, { ...source.body, name: keepsName ? source.body.name : copyName(source.body.name, taken) });
    return saved.ok ? { ok: true, templateId: saved.templateId } : saved;
  };
}
