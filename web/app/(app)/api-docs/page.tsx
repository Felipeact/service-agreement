import type { Metadata } from "next";
import { ApiDocsView } from "./_components/content";
import { loadApiDocs } from "./_data-access/api-docs";

export const metadata: Metadata = { title: "API reference", robots: { index: false } };

export default async function ApiDocsPage() {
  return <ApiDocsView {...(await loadApiDocs())} />;
}
