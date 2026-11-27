import type { Metadata } from "next";
import { Content } from "./_components/content";

export const metadata: Metadata = {
  title: "API and AI connection",
  description: "Connect your own software or an AI client such as Claude to your Service Pacts data. Reads on Team, draft writes on Business.",
};

/** Static documentation: the endpoints and limits come from the same tables the API enforces, so the page cannot drift. */
export default function DevelopersPage() {
  return <Content />;
}
