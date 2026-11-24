import { Icon } from "@/components/ui/icons";
import { LinkButton } from "@/components/ui/link-button";

/**
 * The Contract wording card, in the same grid as the agreement templates (template-editor-v2 AC 36): which wording new contracts use,
 * and for an owner or admin the way into its editor. Everyone else sees the card and no link.
 */
export function ContractWordingCard({ own, canWrite }: { own: boolean; canWrite: boolean }) {
  return (
    <article aria-label="Contract wording" className="flex h-full flex-col gap-3 rounded-panel border border-hairline bg-surface p-5 shadow-card">
      <span aria-hidden="true" className="inline-flex size-10 shrink-0 items-center justify-center rounded-control bg-action-tint text-action">
        <Icon name="file" className="size-5" />
      </span>
      <div className="flex flex-col gap-1">
        <h3 className="font-display text-[16px] leading-snug font-semibold tracking-tight">Contract wording</h3>
        <p className="line-clamp-2 min-h-[2.9em] text-[13px] text-ink-2">The terms, schedules and signature blocks on the contract a customer signs after accepting an agreement.</p>
      </div>
      <hr className="border-hairline" />
      <span className="text-[12px] font-semibold text-ink">{own ? "Your contract wording" : "Standard contract wording"}</span>
      <div className="mt-auto flex flex-wrap gap-2">
        <LinkButton href="/templates/contract/preview" aria-label="Preview contract wording" className="flex-1">
          Preview
        </LinkButton>
        {canWrite && (
          <LinkButton href="/templates/contract" className="flex-1">
            {own ? "Edit" : "Customize"}
          </LinkButton>
        )}
      </div>
    </article>
  );
}
