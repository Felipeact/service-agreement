import type { ReactNode } from "react";
import type { ViewSigningResult } from "@/application/use-cases";
import { TenantLogoImage } from "@/components/ui/tenant-logo";
import { NEUTRAL_ACCENT } from "@/domain/agreement";
import { isAccent } from "@/domain/portal";
import { SigningForm } from "./signing-form";

export const SIGNED_MESSAGE = "You have signed this contract.";
export const CLOSED_MESSAGE = "This contract is no longer open for signature.";
export const UNAVAILABLE_MESSAGE = "This link is not working right now.";

type SigningViewProps = {
  /** Anything but `null`: an unknown link is the not-found page, not this view. */
  result: NonNullable<ViewSigningResult>;
  /** The public address of the contractor's logo, `null` when it has none. */
  logoUrl?: string | null;
};

function Message({ children }: { children: ReactNode }) {
  return (
    <div role="status" className="flex flex-col gap-1 rounded-panel border border-hairline bg-surface px-4 py-3 text-[14px] font-medium text-ink">
      {children}
    </div>
  );
}

/**
 * What the customer's signer sees at `/sign/<token>`: the tenant's name and colour, the contract's number and the signer's
 * name, then the embedded form, a thank-you, or the end of the road. It names no product (signature-provider S3).
 */
export function SigningView({ result, logoUrl = null }: SigningViewProps) {
  if (result.state === "unavailable") {
    return (
      <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col justify-center gap-2 px-4 py-10">
        <h1 className="text-[18px] font-bold">{UNAVAILABLE_MESSAGE}</h1>
      </main>
    );
  }

  const { tenant, agreementNumber, signerName, state, embedSrc } = result;
  const tenantName = tenant?.name ?? "the company";
  const accent = tenant?.accent && isAccent(tenant.accent) ? tenant.accent : NEUTRAL_ACCENT;

  return (
    <div className="min-h-dvh bg-ground">
      <header className="border-b border-hairline bg-surface">
        <div className="mx-auto flex max-w-[760px] flex-col gap-0.5 px-4 py-4">
          {logoUrl && <TenantLogoImage src={logoUrl} name={tenantName} />}
          <p className="text-[18px] font-bold break-words">{tenantName}</p>
          {tenant?.address && <p className="text-[13px] text-ink-2">{tenant.address}</p>}
          {tenant?.phone && <p className="text-[13px] text-ink-2">{tenant.phone}</p>}
        </div>
      </header>
      <main className="mx-auto flex max-w-[760px] flex-col gap-4 px-4 py-6">
        <div className="flex flex-col gap-2">
          <div data-accent-rule="" style={{ backgroundColor: accent }} className="h-1 w-16 rounded-full" />
          <h1 className="text-[20px] font-bold">{`Contract ${agreementNumber}`}</h1>
          <p className="text-[13px] text-ink-2">{`Signer: ${signerName}`}</p>
        </div>
        {state === "open" && embedSrc && <SigningForm src={embedSrc} />}
        {state === "signed" && <Message>{SIGNED_MESSAGE}</Message>}
        {state === "closed" && <Message>{CLOSED_MESSAGE}</Message>}
      </main>
    </div>
  );
}
