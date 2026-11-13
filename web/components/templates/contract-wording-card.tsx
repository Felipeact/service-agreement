import { LinkButton } from "@/components/ui/link-button";

/**
 * The Contract wording card below the agreement templates (block-editor AC 46): which wording new contracts use, and for an owner or
 * admin the way into its editor. Everyone else sees the card and no link.
 */
export function ContractWordingCard({ own, canWrite }: { own: boolean; canWrite: boolean }) {
  return (
    <section aria-label="Contract wording" className="flex flex-col gap-3 rounded-panel border border-hairline bg-surface p-4 shadow-card md:flex-row md:items-center md:justify-between">
      <div className="flex flex-col gap-0.5">
        <h2 className="font-display text-[16px] font-semibold tracking-tight">Contract wording</h2>
        <p className="text-[13px] font-medium text-ink">{own ? "Your contract wording" : "Standard contract wording"}</p>
        <p className="text-[13px] text-ink-2">The terms, schedules and signature blocks on the contract a customer signs after accepting an agreement.</p>
      </div>
      {canWrite && <LinkButton href="/templates/contract">{own ? "Edit" : "Customize"}</LinkButton>}
    </section>
  );
}
