import type { AgreementTemplateSummary, MemberRole } from "@/application/ports";
import { ItemText } from "@/components/shell/item-words";
import { PageHeader } from "@/components/shell/page-header";
import { EmptyPanel } from "@/components/ui/empty-panel";
import { Icon } from "@/components/ui/icons";
import { LinkButton } from "@/components/ui/link-button";
import { canUseTemplates, canWriteTemplates, LOAD_ERROR } from "./state";
import type { TemplateCardActions } from "./template-card";
import { TemplateGrid, type UseDialogProps } from "./template-grid";

type Props = {
  /** `null` when the list could not be read (agreement-templates AC 22). */
  templates: AgreementTemplateSummary[] | null;
  role: MemberRole;
  now: Date;
  actions?: TemplateCardActions;
  /** What the New agreement dialog needs, for a member who can use templates; Use template opens it over this page. */
  dialog?: UseDialogProps;
  /** Whether the org has its own contract wording; absent when it could not be read, and then no card is drawn (block-editor AC 46). */
  contractWording?: { own: boolean };
};

/** The Templates page body: one grid of cards, the contract wording among them (template-editor-v2 S6). */
export function TemplatesView({ templates, role, now, actions, dialog, contractWording }: Props) {
  const canWrite = canWriteTemplates(role);
  const canUse = canUseTemplates(role);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Agreement templates"
        subtitle={<ItemText>Layouts your estimators start from. Customers see your logo and colour on every one.</ItemText>}
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
      ) : templates.length === 0 ? (
        <EmptyPanel title="No templates yet." />
      ) : (
        <TemplateGrid templates={templates} canWrite={canWrite} canUse={canUse} now={now} actions={actions} dialog={dialog} contractWording={contractWording} />
      )}
    </div>
  );
}
