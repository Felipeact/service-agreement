import { notFound } from "next/navigation";
import { getContainer } from "@/composition";

/**
 * What the signing page reads for a link: the signing state and the tenant's logo address. A page render writes nothing, and
 * neither does anything on it (signature-provider AC 22, AC 23); an unknown link is a 404.
 */
export async function loadSigning(token: string) {
  const { viewSigning, logo } = await getContainer();
  const result = await viewSigning(token);
  if (!result) notFound();
  return { result, logoUrl: logo.url(result.state === "unavailable" ? null : (result.tenant?.logoPath ?? null)) };
}
