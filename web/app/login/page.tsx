import type { Metadata } from "next";
import { Suspense } from "react";
import { RooftopScene } from "@/components/ui/illustrations";
import { ProductMark } from "@/components/ui/product-mark";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Sign in",
};

const PRODUCT_NAME = "Service Agreement";

/** Reads `?error=` at request time; the plain form is the prerendered fallback (door 6). */
export async function LoginFormForRequest({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const { error } = await searchParams;
  return <LoginForm linkInvalid={error === "link_invalid"} />;
}

/**
 * Night panel (the product, and what it is for) beside the sign-in card. Below 1024px the panel is a short band
 * over the card and the drawing is left out, so the form stays the first thing a phone shows.
 */
export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main className="min-h-dvh lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <section className="flex flex-col bg-night px-5 pt-6 pb-8 text-surface sm:px-8 lg:px-14 lg:py-12">
        <div className="flex items-center gap-2.5">
          <ProductMark className="size-9" />
          <p className="font-display text-[18px] font-semibold tracking-tight">{PRODUCT_NAME}</p>
        </div>
        <p className="pt-3 text-night-ink lg:hidden">Recurring service agreements for trade contractors, from the customer&apos;s list to signature.</p>

        <div className="my-auto hidden flex-col gap-10 py-14 lg:flex">
          <p className="max-w-[13ch] font-display text-[48px] leading-[1.02] font-semibold tracking-tight text-balance">
            From service list to signed agreement.
          </p>
          <RooftopScene className="w-full max-w-[480px] text-night-ink" />
        </div>
        <p className="hidden text-night-ink lg:block">Recurring service agreements for trade contractors.</p>
      </section>

      <section className="flex justify-center px-4 py-8 lg:items-center lg:px-10">
        <div className="w-full max-w-[400px] self-start rounded-panel border border-hairline bg-surface px-6 py-7 shadow-panel sm:px-8 lg:self-center">
          <Suspense fallback={<LoginForm linkInvalid={false} />}>
            <LoginFormForRequest searchParams={searchParams} />
          </Suspense>
        </div>
      </section>
    </main>
  );
}
