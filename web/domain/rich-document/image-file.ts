/** A picture placed on a designed page (rich-templates): the rules for the file, its key in the `template-images` bucket and its public address. */

export const TEMPLATE_IMAGE_MAX_BYTES = 3 * 1024 * 1024;
export const TEMPLATE_IMAGE_FILE_ERROR = "Use a PNG or JPEG under 3 MB";
/** The longest side the browser keeps when it prepares a photo, in pixels. */
export const TEMPLATE_IMAGE_MAX_SIDE = 2000;

const EXTENSIONS: Record<string, "png" | "jpg"> = { "image/png": "png", "image/jpeg": "jpg" };

export type TemplateImageFileCheck = { ok: true; ext: "png" | "jpg" } | { ok: false; error: string };

/** A prepared file is a PNG or JPEG of 1 byte to 3 MB; the bucket enforces the same limits again. */
export function checkTemplateImageFile(file: { type: string; size: number }): TemplateImageFileCheck {
  const ext = EXTENSIONS[file.type];
  if (!ext || !Number.isInteger(file.size) || file.size < 1 || file.size > TEMPLATE_IMAGE_MAX_BYTES) return { ok: false, error: TEMPLATE_IMAGE_FILE_ERROR };
  return { ok: true, ext };
}

/** `<org id>/<uuid>.<ext>`: a new key per upload, so a picture is never replaced under a page that already draws it. */
export const templateImageKey = (orgId: string, id: string, ext: "png" | "jpg") => `${orgId}/${id}.${ext}`;

/** Where anyone can read a stored picture. The bucket is public: the customer's review page is anonymous. */
export const templateImageUrl = (base: string, key: string) => `${base.replace(/\/+$/, "")}/storage/v1/object/public/template-images/${key}`;
