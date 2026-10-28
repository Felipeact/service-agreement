import { getContainer } from "@/composition";
import { portalDocument, portalViewState } from "@/application/use-cases";

/** Seconds. Rendering 2,000 assets measured about 22 s (C870); this is more than twice that. */
export const maxDuration = 60;

const empty = (status: number) => new Response(null, { status, headers: { "Cache-Control": "private, no-store" } });

/** The PDF of the version a link names, for the states that show content; anything else is an empty 404 (customer-portal AC 28 to 30). */
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  try {
    const { viewPortal, documentRenderer } = await getContainer();
    const view = await viewPortal(token);
    if (!view) return empty(404);
    const state = portalViewState(view);
    if (state !== "open" && state !== "decided" && state !== "superseded") return empty(404);

    const document = portalDocument(view);
    if (!document) throw new Error("the tenant has no settings row");
    const bytes = await documentRenderer.renderAgreement(document);
    return new Response(bytes as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${view.agreement.number}-v${view.link.versionNo}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("Portal PDF failed", error);
    return empty(503);
  }
}
