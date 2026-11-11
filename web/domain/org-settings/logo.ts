/** The org's logo (tenant-logo): the rules for the file, its key in the `logos` bucket and its public address. */

export const LOGO_MAX_BYTES = 1048576;

export const LOGO_FILE_ERROR = "Use a PNG or JPEG under 1 MB";

export const LOGO_PATH_ERROR = "That logo is not one of this company's uploads";

/** What a logo is when a document draws it: the bytes and which of the two formats they are. */
export type TenantLogo = { bytes: Uint8Array; format: "png" | "jpg" };

const EXTENSIONS: Record<string, "png" | "jpg"> = { "image/png": "png", "image/jpeg": "jpg" };

export type LogoFileCheck = { ok: true; ext: "png" | "jpg" } | { ok: false; error: string };

/** A picked file is a PNG or JPEG of 1 to 1,048,576 bytes; the bucket enforces the same limits again. */
export function checkLogoFile(file: { type: string; size: number }): LogoFileCheck {
  const ext = EXTENSIONS[file.type];
  if (!ext || !Number.isInteger(file.size) || file.size < 1 || file.size > LOGO_MAX_BYTES) return { ok: false, error: LOGO_FILE_ERROR };
  return { ok: true, ext };
}

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

/** The key of an uploaded logo: `<org id>/<uuid>.<ext>`, a new uuid per upload so a replaced logo is never served stale (door 1). */
export function logoKey(orgId: string, id: string, ext: "png" | "jpg"): string {
  return `${orgId}/${id}.${ext}`;
}

/** A submitted `logoPath` is empty (no logo) or a key of the caller's own org; `org_settings_logo_path_shape` says the same. */
export function isOwnLogoPath(orgId: string, path: string): boolean {
  return path === "" || new RegExp(`^${orgId}/${UUID}\\.(png|jpg)$`).test(path);
}

/** Where anyone can read a stored logo; `null` for none. The bucket is public (door 1). */
export function logoPublicUrl(base: string, path: string | null): string | null {
  return path === null ? null : `${base.replace(/\/+$/, "")}/storage/v1/object/public/logos/${path}`;
}

/** `png` or `jpg` when the bytes start with that format's signature, else `null`. */
export function logoFormat(bytes: Uint8Array): "png" | "jpg" | null {
  if (bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((byte, i) => bytes[i] === byte)) return "png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  return null;
}

/** A document whose letterhead block (`tenant` on an agreement, `contractor` on a contract) gets the logo; with none the document is returned untouched. */
export function withLogo<K extends "tenant" | "contractor", D extends Record<K, object>>(document: D, key: K, logo: TenantLogo | null): D {
  return logo === null ? document : { ...document, [key]: { ...document[key], logo } };
}
