import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHero, Wrap } from "@/components/site/sections";
import { SiteShell } from "@/components/site/site-shell";
import { LinkButton } from "@/components/ui/link-button";
import { SuccessStatus } from "./success-status";

export const metadata: Metadata = { title: "Thanks" };

/**
 * Where Stripe returns a visitor after the subscription is set up (billing-checkout S3). Static on purpose: it reads nothing from
 * the request on the server. `SuccessStatus` reads `session_id` on the client and shows whether the workspace is built
 * (workspace-pending-state); without one, or until it loads, the visitor sees this page's own copy.
 */
export default function RegisterSuccessPage() {
  const hero = (
    <PageHero
      title="You are subscribed."
      text="We will email a sign-in link to the address you gave at checkout. Open it to set up your company."
    >
      <div>
        <LinkButton href="/login" variant="primary">
          Sign in
        </LinkButton>
      </div>
    </PageHero>
  );
  return (
    <SiteShell>
      <Suspense fallback={hero}>
        <SuccessStatus fallback={hero} />
      </Suspense>
      <section className="bg-surface">
        <Wrap className="py-10 lg:py-14">
          <p className="max-w-[62ch] text-ink-2">If the email does not arrive within a few minutes, check your spam folder, then write to us from the contact page.</p>
        </Wrap>
      </section>
    </SiteShell>
  );
}
