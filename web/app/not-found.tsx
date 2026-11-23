import type { Metadata } from "next";
import { Content } from "./_components/not-found-content";

export const metadata: Metadata = { title: "Page not found" };

/** The public 404, from the owner's mockup (docs/service_pacts_404_not_found). */
export default function NotFound() {
  return <Content />;
}
