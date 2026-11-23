import type { LayoutItem } from "@/domain/agreement/layout";
import type { TenantLogo } from "@/domain/org-settings/logo";
import { imageAssetsOf, layoutImageAssets } from "@/domain/rich-document";
import { hasImage } from "./logo-fallback";

/** Reads one uploaded picture by its key; `null` when it cannot be read (it is then left out of the document). */
export type ImageLoader = (key: string) => Promise<TenantLogo | null>;

/**
 * The pictures a document's designed page draws, read in parallel. `undefined` when the page has none or no loader is given, so a
 * document without a designed page is never changed. A picture that cannot be read is left out, never a failed document.
 */
export async function loadRichImages(layout: readonly LayoutItem[] | undefined, load: ImageLoader | undefined, header?: readonly unknown[] | null): Promise<Record<string, TenantLogo> | undefined> {
  const keys = [...new Set([...layoutImageAssets(layout), ...imageAssetsOf(header ?? [])])];
  if (keys.length === 0 || !load) return undefined;
  const loaded = await Promise.all(
    keys.map(async (key) => {
      try {
        return [key, await load(key)] as const;
      } catch (cause) {
        console.error(`Loading picture ${key} failed, so the document leaves it out: ${cause instanceof Error ? cause.message : String(cause)}`);
        return [key, null] as const;
      }
    }),
  );
  return Object.fromEntries(loaded.filter((entry): entry is readonly [string, TenantLogo] => entry[1] !== null));
}

/**
 * Renders a document with its pictures; when drawing them throws (a file the PDF library cannot decode), the document still goes
 * out without them and one line says why. A document with no pictures is rendered once, as it always was.
 */
export async function renderWithoutImagesOnFailure<D extends { images?: Record<string, TenantLogo> }>(
  document: D,
  render: (document: D) => Promise<Uint8Array | Buffer>,
): Promise<Uint8Array | Buffer> {
  const count = Object.keys(document.images ?? {}).length;
  if (count === 0) return render(document);
  try {
    const pdf = await render(document);
    if (!hasImage(new Uint8Array(pdf))) console.error("The page's pictures could not be drawn, so the document has none");
    return pdf;
  } catch (cause) {
    console.error(`Drawing the page's pictures failed, so the document has none: ${cause instanceof Error ? cause.message : String(cause)}`);
    return render({ ...document, images: {} });
  }
}
