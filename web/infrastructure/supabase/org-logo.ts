import type { SupabaseClient } from "@supabase/supabase-js";
import type { OrgLogo } from "@/application/ports";
import { LOGO_MAX_BYTES, logoFormat, logoKey, logoPublicUrl } from "@/domain/org-settings/logo";
import type { Database } from "./database.types";

type Client = SupabaseClient<Database>;

const BUCKET = "logos";

export type OrgLogoOptions = {
  /** The project URL; the bucket is public, so a logo is read at `<baseUrl>/storage/v1/object/public/logos/<path>` (door 1). */
  baseUrl: string;
  fetch?: typeof fetch;
  /** A fetch longer than this is given up on (door 2). */
  timeoutMs?: number;
  newId?: () => string;
};

/** The org's logo over `org_settings.logo_path` and the public `logos` bucket (tenant-logo doors 1 and 2). */
export function supabaseOrgLogo(client: Client, options: OrgLogoOptions): OrgLogo {
  const doFetch = options.fetch ?? fetch;
  const timeoutMs = options.timeoutMs ?? 3000;
  const newId = options.newId ?? (() => crypto.randomUUID());

  const describe = (cause: unknown) => (cause instanceof Error ? cause.message : String(cause));

  return {
    async current(orgId) {
      const { data, error } = await client.from("org_settings").select("logo_path").eq("org_id", orgId).maybeSingle();
      if (error) throw new Error(`Supabase error ${error.code}: ${error.message}`);
      return data?.logo_path ?? null;
    },

    async prepareUpload(orgId, ext) {
      const path = logoKey(orgId, newId(), ext);
      try {
        const signed = await client.storage.from(BUCKET).createSignedUploadUrl(path);
        if (signed.error) {
          console.error(`Signing a logo upload failed: ${signed.error.message}`);
          return { ok: false };
        }
        return { ok: true, path, signedUrl: signed.data.signedUrl };
      } catch (cause) {
        console.error(`Signing a logo upload failed: ${describe(cause)}`);
        return { ok: false };
      }
    },

    async remove(path) {
      try {
        const removed = await client.storage.from(BUCKET).remove([path]);
        if (removed.error) console.error(`Removing logo ${path} failed: ${removed.error.message}`);
      } catch (cause) {
        console.error(`Removing logo ${path} failed: ${describe(cause)}`);
      }
    },

    async load(path) {
      if (path === null) return null;
      const url = logoPublicUrl(options.baseUrl, path)!;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await doFetch(url, { signal: controller.signal });
        if (!response.ok) throw new Error(`status ${response.status}`);
        const bytes = new Uint8Array(await response.arrayBuffer());
        if (bytes.length > LOGO_MAX_BYTES) throw new Error("larger than 1 MB");
        const format = logoFormat(bytes);
        if (!format) throw new Error("not a PNG or JPEG");
        return { bytes, format };
      } catch (cause) {
        console.error(`Loading logo ${path} failed, so the document has none: ${controller.signal.aborted ? "timed out" : describe(cause)}`);
        return null;
      } finally {
        clearTimeout(timer);
      }
    },

    url: (path) => logoPublicUrl(options.baseUrl, path),
  };
}
