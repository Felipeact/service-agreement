import { ProductMark } from "@/components/ui/product-mark";

const PRODUCT_NAME = "Service Pacts";

type WorkspaceCardProps = {
  /** The signed-in member's company. */
  orgName: string;
  /** The plan's display name ("Pro"); absent when the org has no plan to show. */
  planName?: string;
  /** Size of the product mark: the drawer and the sidebar use the same one. */
  markClass?: string;
};

/**
 * The workspace card at the top of the sidebar and the drawer (docs/DESIGN.md "App Shell"): the product mark, the product
 * name with the plan beside it, and the tenant's company under it. It sits on the Night shell.
 */
export function WorkspaceCard({ orgName, planName, markClass = "size-9" }: WorkspaceCardProps) {
  return (
    <div className="flex min-w-0 items-center gap-2.5 rounded-panel border border-night-line bg-night-raised p-2.5">
      <ProductMark className={markClass} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-[14px] leading-tight font-semibold text-surface">{PRODUCT_NAME}</span>
          {planName && (
            <span className="shrink-0 rounded-control border border-action/50 bg-action/15 px-1.5 text-[10px] leading-4 font-semibold tracking-wide text-night-ink uppercase">
              {planName}
            </span>
          )}
        </div>
        <div className="truncate pt-0.5 text-[12px] leading-snug text-night-ink" title={orgName}>
          {orgName}
        </div>
      </div>
    </div>
  );
}
