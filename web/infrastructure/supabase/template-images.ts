import type { SupabaseClient } from "@supabase/supabase-js";
import type { TemplateImages } from "@/application/ports";
import { logoFormat } from "@/domain/org-settings/logo";
import { IMAGE_ASSET, TEMPLATE_IMAGE_MAX_BYTES, templateImageKey, templateImageUrl } from "@/domain/rich-document";
import type { Database } from "./database.types";

type Client = SupabaseClient<Database>;

const BUCKET = "template-images";

export type TemplateImagesOptions = {
  /** The project URL; the bucket is public, so a picture is read at `<baseUrl>/storage/v1/object/public/template-images/<key>`. */
  baseUrl: string;
  fetch?: typeof fetch;
  /** A fetch longer than this is given up on. */
  timeoutMs?: number;
  newId?: () => string;
};

const describe = (cause: unknown) => (cause instanceof Error ? cause.message : String(cause));

/** Reads stored pictures over the public bucket; needs no session, so every renderer can use it. */
export function publicTemplateImageLoader(options: Omit<TemplateImagesOptions, "newId">): TemplateImages["load"] {
  const doFetch = options.fetch ?? fetch;
  const timeoutMs = options.timeoutMs ?? 4000;
  return async (key) => {
    // Only a key of the upload shape is ever fetched, so a stored body can never point the server at another address.
    if (!IMAGE_ASSET.test(key)) {
      console.error(`Picture ${key} is not an upload key, so the document leaves it out`);
      return null;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await doFetch(templateImageUrl(options.baseUrl, key), { signal: controller.signal });
      if (!response.ok) throw new Error(`status ${response.status}`);
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.length > TEMPLATE_IMAGE_MAX_BYTES) throw new Error("larger than 3 MB");
      const format = logoFormat(bytes);
      if (!format) throw new Error("not a PNG or JPEG");
      return { bytes, format };
    } catch (cause) {
      console.error(`Loading picture ${key} failed, so the document leaves it out: ${controller.signal.aborted ? "timed out" : describe(cause)}`);
      return null;
    } finally {
      clearTimeout(timer);
    }
  };
}

/** The pictures of designed pages over the public `template-images` bucket; uploads are signed for the member's own org. */
export function supabaseTemplateImages(client: Client, options: TemplateImagesOptions): TemplateImages {
  const newId = options.newId ?? (() => crypto.randomUUID());
  return {
    async prepareUpload(orgId, ext) {
      const path = templateImageKey(orgId, newId(), ext);
      try {
        const signed = await client.storage.from(BUCKET).createSignedUploadUrl(path);
        if (signed.error) {
          console.error(`Signing a picture upload failed: ${signed.error.message}`);
          return { ok: false };
        }
        return { ok: true, path, signedUrl: signed.data.signedUrl };
      } catch (cause) {
        console.error(`Signing a picture upload failed: ${describe(cause)}`);
        return { ok: false };
      }
    },
    load: publicTemplateImageLoader(options),
    url: (key) => templateImageUrl(options.baseUrl, key),
  };
}
