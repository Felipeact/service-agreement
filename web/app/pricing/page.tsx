import type { Metadata } from "next";
import Link from "next/link";
import { ProductMark } from "@/components/ui/product-mark";
import { PricingForm } from "./pricing-form";

export const metadata: Metadata = {
  title: "Pricing",
};

const PRODUCT_NAME = "Service Agreement";

/** Shown above the plans; the roadmap's trial terms (decision 8). */
const TRIAL_LINE = "14-day free trial. A card is required to start, and billing is monthly after the trial.";

/**
 * The public price page (pricing-page): a Night band with the product, the plain trial terms and a way back in for
 * existing members, then the trades and the three plans on Cool Ground. Static, so it prerenders.
 */
export default function PricingPage() {
  return (
    <main className="min-h-dvh">
      <header className="bg-night px-4 pt-5 pb-10 text-surface md:px-6 lg:px-8 lg:pb-14">
        <div className="mx-auto flex max-w-[1080px] flex-col gap-8 lg:gap-12">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <ProductMark className="size-8" />
              <p className="font-display text-[16px] font-semibold tracking-tight">{PRODUCT_NAME}</p>
            </div>
            <Link
              href="/login"
              className="inline-flex min-h-11 items-center rounded-control px-3 text-[13px] font-semibold text-night-ink transition-colors duration-150 hover:bg-surface/10 hover:text-surface lg:min-h-[34px]"
            >
              Sign in
            </Link>
          </div>
          <div className="flex flex-col gap-3">
            <h1 className="max-w-[18ch] font-display text-[36px] leading-[1.05] font-semibold tracking-tight text-balance lg:text-[52px]">Plans and pricing</h1>
            <p className="max-w-[60ch] text-[14px] text-night-ink">{TRIAL_LINE}</p>
          </div>
        </div>
      </header>

      <div className="px-4 py-8 md:px-6 lg:px-8 lg:py-12">
        <div className="mx-auto max-w-[1080px]">
          <PricingForm />
        </div>
      </div>
    </main>
  );
}
