import type { Metadata } from "next";
import { DEMO_VIDEO_URL } from "@/components/site/content";
import { CtaBand, PageHero, Wrap } from "@/components/site/sections";
import { SiteShell } from "@/components/site/site-shell";
import { DemoWalkthrough } from "./demo-walkthrough";

export const metadata: Metadata = { title: "Demo" };

/**
 * The walkthrough: a recorded video when one exists (`DEMO_VIDEO_URL`), and always the six steps as sample screens.
 * Every screen is synthetic and says so.
 */
export default function DemoPage() {
  return (
    <SiteShell>
      <PageHero title="See a deal move." text="Walk the six steps from a customer's list to a signed contract, using a fictitious contractor and sample data." />
      <section className="bg-ground">
        <Wrap className="pb-14 lg:pb-20">
          {DEMO_VIDEO_URL ? (
            <video controls preload="metadata" className="aspect-video w-full rounded-panel bg-night shadow-panel" src={DEMO_VIDEO_URL}>
              Your browser cannot play this video.
            </video>
          ) : (
            <div className="flex aspect-video max-h-[420px] w-full flex-col items-center justify-center gap-2 rounded-panel bg-night p-6 text-center text-surface shadow-panel">
              <p className="font-display text-[24px] font-semibold tracking-tight">Video walkthrough coming soon</p>
              <p className="max-w-[44ch] text-night-ink">Until it is recorded, step through the same story below.</p>
            </div>
          )}
        </Wrap>
      </section>
      <section className="bg-surface">
        <Wrap className="py-14 lg:py-20">
          <DemoWalkthrough />
        </Wrap>
      </section>
      <CtaBand title="Try it with your own list." />
    </SiteShell>
  );
}
