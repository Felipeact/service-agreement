import type { Metadata } from "next";
import { FAQS } from "@/components/site/content";
import { CtaBand, FaqList, PageHero, Wrap } from "@/components/site/sections";
import { SiteShell } from "@/components/site/site-shell";

export const metadata: Metadata = { title: "FAQ" };

/** The questions in three groups, so a buyer finds theirs without reading twelve. A question not listed here is shown last. */
const GROUPS: { title: string; questions: string[] }[] = [
  {
    title: "How it works",
    questions: ["Who is it for?", "Is it a field-service suite?", "What file types can I import?", "Can I use more than one trade?", "What does it not do?"],
  },
  {
    title: "Customers and signing",
    questions: ["Does my customer need an account?", "Will my customer see your brand?", "Are e-signatures legally valid?", "What about Quebec?"],
  },
  {
    title: "Plans and billing",
    questions: ["How does billing work?", "What is a live agreement?", "Do you charge per seat?"],
  },
];

export default function FaqPage() {
  const listed = new Set(GROUPS.flatMap((group) => group.questions));
  const groups = [...GROUPS.map((group) => ({ title: group.title, items: FAQS.filter((f) => group.questions.includes(f.q)) })), { title: "More", items: FAQS.filter((f) => !listed.has(f.q)) }].filter((group) => group.items.length > 0);
  return (
    <SiteShell>
      <PageHero title="Questions, answered plainly." text="If yours is not here, write to us from the contact page." />
      <section className="bg-ground">
        <Wrap className="flex max-w-[860px] flex-col gap-10 pb-14 lg:pb-20">
          {groups.map((group) => (
            <div key={group.title} className="flex flex-col gap-3">
              <h2 className="font-display text-[22px] font-semibold tracking-tight">{group.title}</h2>
              <FaqList items={group.items} />
            </div>
          ))}
        </Wrap>
      </section>
      <CtaBand />
    </SiteShell>
  );
}
