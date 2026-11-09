import type { Metadata } from "next";
import { SITE } from "@/components/site/content";
import { PageHero, Wrap } from "@/components/site/sections";
import { SiteShell } from "@/components/site/site-shell";

export const metadata: Metadata = { title: "Contact" };

export default function ContactPage() {
  return (
    <SiteShell>
      <PageHero title="Talk to us." text="Questions about a trade, a list you quote from, or the legal side of e-signature? Write to us and a person answers." />
      <section className="bg-surface">
        <Wrap className="grid gap-6 py-14 md:grid-cols-2 lg:py-20">
          <div className="flex flex-col gap-3 rounded-panel border border-hairline bg-ground p-6">
            <h2 className="font-display text-[20px] font-semibold tracking-tight">Email</h2>
            <a href={`mailto:${SITE.contactEmail}`} className="inline-flex min-h-11 w-fit items-center text-[16px] font-semibold text-action hover:underline">
              {SITE.contactEmail}
            </a>
            <p className="text-ink-2">Tell us your trade, roughly how many agreements you run, and what you quote from today.</p>
          </div>
          <div className="flex flex-col gap-3 rounded-panel border border-hairline bg-ground p-6">
            <h2 className="font-display text-[20px] font-semibold tracking-tight">Already a member?</h2>
            <p className="text-ink-2">Sign in from the top of any page. A sign-in link is emailed to you, so there is no password to remember.</p>
          </div>
        </Wrap>
      </section>
    </SiteShell>
  );
}
