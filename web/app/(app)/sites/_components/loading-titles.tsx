"use client";

import { PageLoading } from "@/components/shell/page-loading";
import { useItemWords } from "@/components/shell/item-words";

/** The Sites screen's loading state, titled with the org's word; a loading file cannot wait for the org's settings. */
export function SitesLoading() {
  return <PageLoading title={`Sites & ${useItemWords().plural}`} />;
}

/** The import screen's loading state, titled with the org's word. */
export function ImportLoading() {
  return <PageLoading title={`Import ${useItemWords().singular} list`} />;
}
