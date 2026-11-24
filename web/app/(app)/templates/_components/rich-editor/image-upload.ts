import { checkTemplateImageFile, TEMPLATE_IMAGE_MAX_SIDE } from "@/domain/rich-document";
import type { TemplateImageUploadAnswer } from "../../_actions/image";

export const PICTURE_UNREADABLE = "That file isn't a picture this page can use. Choose a PNG or JPEG photo.";
export const PICTURE_FAILED = "The picture didn't upload. Try again.";

/** A picture ready to upload: PNG or JPEG bytes, at most 2,000 pixels on its longest side. */
export type PreparedPicture = { blob: Blob; type: "image/png" | "image/jpeg" };

export type PictureDeps = {
  /** Turns any picture the browser can decode into PNG or JPEG bytes (a canvas in the browser). */
  prepare: (file: File) => Promise<PreparedPicture | null>;
  /** The server half: checks again and signs an upload for a new key. */
  sign: (file: { type: string; size: number }) => Promise<TemplateImageUploadAnswer>;
  /** Sends the bytes to the signed URL; `true` when Storage accepted them. */
  put: (signedUrl: string, blob: Blob, contentType: string) => Promise<boolean>;
};

export type PictureResult = { ok: true; path: string } | { ok: false; error: string };

/**
 * The browser half of a picture upload: prepare the file (phones' photos are large and may be HEIC or WebP, which the PDF cannot
 * draw), refuse what is still outside the rule without asking the server, sign, then PUT straight to Storage.
 */
export async function uploadPicture(file: File, deps: PictureDeps): Promise<PictureResult> {
  let prepared: PreparedPicture | null;
  try {
    prepared = await deps.prepare(file);
  } catch {
    prepared = null;
  }
  if (!prepared) return { ok: false, error: PICTURE_UNREADABLE };
  const checked = checkTemplateImageFile({ type: prepared.type, size: prepared.blob.size });
  if (!checked.ok) return { ok: false, error: checked.error };
  try {
    const signed = await deps.sign({ type: prepared.type, size: prepared.blob.size });
    if (!signed.success) return { ok: false, error: signed.message };
    return (await deps.put(signed.signedUrl, prepared.blob, signed.contentType)) ? { ok: true, path: signed.path } : { ok: false, error: PICTURE_FAILED };
  } catch {
    return { ok: false, error: PICTURE_FAILED };
  }
}

/** The scale that fits `width` by `height` within the longest side allowed, never enlarging. */
export const fitScale = (width: number, height: number, max = TEMPLATE_IMAGE_MAX_SIDE) => Math.min(1, max / Math.max(width, height, 1));

/**
 * Draws the picture on a canvas at most 2,000 pixels on its longest side: a PNG stays PNG (it may hold a transparent logo), anything
 * else becomes a JPEG. `null` when the browser cannot decode the file.
 */
export async function prepareInBrowser(file: File): Promise<PreparedPicture | null> {
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return null;
  const scale = fitScale(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) return null;
  const encode = (type: PreparedPicture["type"]) => new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.86));
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  if (file.type === "image/png") {
    const png = await encode("image/png");
    // A photo saved as PNG can still be over the limit; it goes as a JPEG instead.
    if (png && checkTemplateImageFile({ type: "image/png", size: png.size }).ok) {
      bitmap.close();
      return { blob: png, type: "image/png" };
    }
  }
  // JPEG has no transparency: a transparent area prints white, as on paper.
  context.globalCompositeOperation = "destination-over";
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  bitmap.close();
  const jpeg = await encode("image/jpeg");
  return jpeg ? { blob: jpeg, type: "image/jpeg" } : null;
}

export async function putPicture(signedUrl: string, blob: Blob, contentType: string): Promise<boolean> {
  const response = await fetch(signedUrl, { method: "PUT", headers: { "Content-Type": contentType }, body: blob });
  return response.ok;
}
