import type { Metadata } from "next";
import { Content } from "./_components/content";

export const metadata: Metadata = { title: "Demo" };

/** From the owner's mockup (docs/service_pacts_demo). */
export default function DemoPage() {
  return <Content />;
}
