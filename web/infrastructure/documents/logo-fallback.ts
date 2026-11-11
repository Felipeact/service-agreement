import type { TenantLogo } from "@/domain/org-settings/logo";

/** True when the PDF holds an image object, which is how a drawn logo shows in the file. */
export function hasImage(pdf: Uint8Array): boolean {
  return Buffer.from(pdf).includes("/Subtype /Image");
}

/**
 * Renders a document with its logo. The renderer drops a picture it cannot decode without saying so, and may throw on
 * another; either way the document still goes out, without the logo, and one line says why (tenant-logo AC 19).
 */
export async function renderWithoutLogoOnFailure<D extends { tenant?: object; contractor?: object }>(
  document: D,
  logo: TenantLogo | undefined,
  render: (document: D) => Promise<Uint8Array | Buffer>,
): Promise<Uint8Array> {
  try {
    const pdf = new Uint8Array(await render(document));
    if (logo && !hasImage(pdf)) console.error("The logo could not be drawn, so the document has none");
    return pdf;
  } catch (cause) {
    if (!logo) throw cause;
    console.error(`Drawing the logo failed, so the document has none: ${cause instanceof Error ? cause.message : String(cause)}`);
    const key = document.tenant ? "tenant" : "contractor";
    const rest: { logo?: TenantLogo } = { ...(document[key] as { logo?: TenantLogo }) };
    delete rest.logo;
    return new Uint8Array(await render({ ...document, [key]: rest }));
  }
}
