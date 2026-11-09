import type { Metadata } from "next";
import { PageHero, Wrap } from "@/components/site/sections";
import { SiteShell } from "@/components/site/site-shell";
import { LinkButton } from "@/components/ui/link-button";

export const metadata: Metadata = { title: "Thanks" };

/**
 * Where Stripe returns a visitor after the trial is set up (billing-checkout S3). Static on purpose: it reads nothing from
 * the request. Workspace provisioning will replace the wording with a "setting up your workspace" state.
 */
export default function RegisterSuccessPage() {
  return (
    <SiteShell>
      <PageHero
        title="Your trial is registered."
        text="We will email a sign-in link to the address you gave at checkout. Open it to set up your company."
      >
        <div>
          <LinkButton href="/login" variant="primary">
            Sign in
          </LinkButton>
        </div>
      </PageHero>
      <section className="bg-surface">
        <Wrap className="py-10 lg:py-14">
          <p className="max-w-[62ch] text-ink-2">If the email does not arrive within a few minutes, check your spam folder, then write to us from the contact page.</p>
        </Wrap>
      </section>
    </SiteShell>
  );
}
