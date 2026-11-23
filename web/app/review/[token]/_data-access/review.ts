import { notFound } from "next/navigation";
import { portalViewState } from "@/application/use-cases";
import { getContainer } from "@/composition";

/**
 * What the customer's review page reads for a link: the agreement as the portal shows it, the state of the link and the tenant's
 * logo address. A page render writes nothing (customer-portal AC 25); an unknown link, or one in the "unknown" state, is a 404.
 */
export async function loadReview(token: string) {
  const { viewPortal, logo } = await getContainer();
  const view = await viewPortal(token);
  if (!view) notFound();
  const state = portalViewState(view);
  if (state === "unknown") notFound();
  return { view, state, logoUrl: logo.url(view.tenant?.logoPath ?? null) };
}
