import type { TenantLogo } from "@/domain/org-settings/logo";

/** The most room the letterhead gives a logo, in points (tenant-logo AC 16). */
export const LOGO_MAX_WIDTH = 160;
export const LOGO_MAX_HEIGHT = 48;

/** The size a logo of `width` by `height` is drawn at: its own size, or scaled down to fit the box with the aspect ratio kept. */
export function logoBox(width: number, height: number): { width: number; height: number } {
  const scale = Math.min(1, LOGO_MAX_WIDTH / width, LOGO_MAX_HEIGHT / height);
  return { width: Math.round(width * scale * 100) / 100, height: Math.round(height * scale * 100) / 100 };
}

/** The pixel size read from the file's own header; `null` when the header does not say (the logo is then left out). */
export function logoSize(logo: TenantLogo): { width: number; height: number } | null {
  const b = logo.bytes;
  if (logo.format === "png") {
    if (b.length < 24) return null;
    const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
    return { width: view.getUint32(16), height: view.getUint32(20) };
  }
  // A JPEG: walk the marker segments to the first start-of-frame, which holds the height then the width.
  let at = 2;
  while (at + 9 < b.length) {
    if (b[at] !== 0xff) return null;
    const marker = b[at + 1];
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: (b[at + 5] << 8) | b[at + 6], width: (b[at + 7] << 8) | b[at + 8] };
    }
    at += 2 + ((b[at + 2] << 8) | b[at + 3]);
  }
  return null;
}
