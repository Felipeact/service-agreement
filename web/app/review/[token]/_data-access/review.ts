import { notFound } from "next/navigation";
import { portalLayout, portalViewState } from "@/application/use-cases";
import { getContainer } from "@/composition";
import { imageAssetsOf, layoutImageAssets } from "@/domain/rich-document";

/**
 * What the customer's review page reads for a link: the agreement as the portal shows it, the state of the link, the tenant's
 * logo address and the public address of each picture its designed page draws. A page render writes nothing (customer-portal
 * AC 25); an unknown link, or one in the "unknown" state, is a 404.
 */
export async function loadReview(token: string) {
  const container = await getContainer();
  const { viewPortal, logo } = container;
  const view = await viewPortal(token);
  if (!view) notFound();
  const state = portalViewState(view);
  if (state === "unknown") notFound();
  return { view, state, logoUrl: logo.url(view.tenant?.logoPath ?? null), imageUrls: imageUrlsOf(view, container) };
}

/** Each picture key of the version's designed page to its public address; none when the page has none or anything cannot be read. */
function imageUrlsOf(view: Parameters<typeof portalLayout>[0], container: { templateImages?: { url: (key: string) => string } }): Record<string, string> {
  try {
    const rendered = portalLayout(view);
    const keys = [...new Set([...layoutImageAssets(rendered.layout), ...imageAssetsOf(rendered.header ?? [])])];
    if (keys.length === 0 || !container.templateImages) return {};
    const images = container.templateImages;
    return Object.fromEntries(keys.map((key) => [key, images.url(key)]));
  } catch {
    return {};
  }
}
