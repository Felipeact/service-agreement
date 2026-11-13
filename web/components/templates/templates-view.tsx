import type { AgreementTemplateSummary, MemberRole } from "@/application/ports";
import { PageHeader } from "@/components/shell/page-header";
import { DEFAULT_ITEM_WORDS, type ItemWords } from "@/domain/org-settings";
import { EmptyPanel } from "@/components/ui/empty-panel";
import { Icon } from "@/components/ui/icons";
import { LinkButton } from "@/components/ui/link-button";
import { ContractWordingCard } from "./contract-wording-card";
import { canUseTemplates, canWriteTemplates, LOAD_ERROR } from "./state";
import { TemplateCard, type TemplateCardActions } from "./template-card";
import { TemplateUseDialog, type UseDialogProps } from "./template-use-dialog";

type Props = {
  /** `null` when the list could not be read (agreement-templates AC 22). */
  templates: AgreementTemplateSummary[] | null;
  /** The card shown in the preview; the page resolves it, so an absent or unknown one is already the first card. */
  selectedId: string | null;
  role: MemberRole;
  typeNames: Record<string, string>;
  now: Date;
  actions?: TemplateCardActions;
  /** The org's item words; the default when absent. */
  words?: ItemWords;
  /** What the New agreement dialog needs, for a member who can use templates; Use template opens it over this page. */
  dialog?: UseDialogProps;
  /** Whether the org has its own contract wording; absent when it could not be read, and then no card is drawn (block-editor AC 46). */
  contractWording?: { own: boolean };
};

/** The Templates page body: the cards, then the preview of the selected one (agreement-templates S3). */
export function TemplatesView({ templates, selectedId, role, typeNames, now, actions, words = DEFAULT_ITEM_WORDS, dialog, contractWording }: Props) {
  const canWrite = canWriteTemplates(role);
  const canUse = canUseTemplates(role);
  const selected = templates?.find((template) => template.id === selectedId) ?? templates?.[0];
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Agreement templates"
        subtitle="Standardize scope and pricing without making every customer agreement feel generic."
        action={
          canWrite && (
            <LinkButton href="/templates/new" variant="primary">
              <Icon name="plus" className="size-4" />
              New template
            </LinkButton>
          )
        }
      />

      {templates === null ? (
        <EmptyPanel title={LOAD_ERROR}>
          <LinkButton href="/templates">Try again</LinkButton>
        </EmptyPanel>
      ) : !selected ? (
        <EmptyPanel title="No templates yet." />
      ) : (
        <div className="flex flex-col gap-4 xl:grid xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start">
          <section aria-label="Templates" className="min-w-0">
            <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {templates.map((template) => (
                <li key={template.id}>
                  <TemplateCard template={template} selected={template.id === selected.id} canWrite={canWrite} now={now} actions={actions} />
                </li>
              ))}
            </ul>
          </section>
          <TemplateUseDialog preview={{ template: selected, typeNames, canUse, canWrite, actions, words }} dialog={dialog} />
        </div>
      )}

      {contractWording && <ContractWordingCard own={contractWording.own} canWrite={canWrite} />}
    </div>
  );
}
