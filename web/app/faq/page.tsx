import type { Metadata } from "next";
import { FAQS } from "@/components/site/content";
import { CtaBand, FaqList, PageHero, Wrap } from "@/components/site/sections";
import { SiteShell } from "@/components/site/site-shell";

export const metadata: Metadata = { title: "FAQ" };

export default function FaqPage() {
  return (
    <SiteShell>
      <PageHero title="Questions, answered plainly." text="If yours is not here, write to us from the contact page." />
      <section className="bg-ground">
        <Wrap className="max-w-[860px] pb-14 lg:pb-20">
          <FaqList items={FAQS} />
        </Wrap>
      </section>
      <CtaBand />
    </SiteShell>
  );
}
