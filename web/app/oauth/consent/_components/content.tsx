import { ProductMark } from "@/components/ui/product-mark";
import { ConsentButtons } from "./consent-buttons";

type Props = { authorizationId: string; clientName: string; email: string; companyName: string };

/** The consent card: who is asking, what they get, and Allow or Cancel. */
export function Content({ authorizationId, clientName, email, companyName }: Props) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[460px] flex-col justify-center gap-5 px-4 py-10">
      <div className="flex flex-col gap-5 rounded-panel border border-hairline bg-surface p-6 shadow-lift">
        <ProductMark className="size-10" />
        <div className="flex flex-col gap-1.5">
          <h1 className="text-[22px] leading-7 font-semibold tracking-tight text-ink">Connect {clientName} to Service Pacts?</h1>
          <p className="text-[13px] text-ink-nav">
            Signed in as {email} at {companyName}.
          </p>
        </div>
        <ul className="flex flex-col gap-2 rounded-card bg-board p-4 text-[13px] text-ink-nav">
          <li>It will see your company&apos;s customers, sites, agreements and reports, the same as you do.</li>
          <li>It can start a draft agreement and fill its service lines, only if your role may.</li>
          <li>It can never send, sign or cancel anything, and never sees another company&apos;s data.</li>
        </ul>
        <ConsentButtons authorizationId={authorizationId} clientName={clientName} />
      </div>
    </main>
  );
}
