import { describe, expect, test } from "vitest";
import { checkLogoFile, isOwnLogoPath, LOGO_FILE_ERROR, logoFormat, logoKey, logoPublicUrl } from "./logo";

const ORG = "6f1c2f0e-0000-4000-8000-000000000001";
const ID = "0b1c2f0e-1111-4222-8333-444455556666";

describe("logo rules", () => {
  test("C3308: a PNG or JPEG of 1 to 1048576 bytes is accepted; every other file is refused with the one message", () => {
    expect(checkLogoFile({ type: "image/png", size: 1 })).toEqual({ ok: true, ext: "png" });
    expect(checkLogoFile({ type: "image/png", size: 1048576 })).toEqual({ ok: true, ext: "png" });
    expect(checkLogoFile({ type: "image/jpeg", size: 1 })).toEqual({ ok: true, ext: "jpg" });
    expect(checkLogoFile({ type: "image/jpeg", size: 1048576 })).toEqual({ ok: true, ext: "jpg" });
    const refused: [string, number][] = [
      ["image/png", 1048577],
      ["image/png", 0],
      ["image/svg+xml", 1000],
      ["image/gif", 1000],
      ["image/webp", 1000],
    ];
    for (const [type, size] of refused) expect(checkLogoFile({ type, size }), `${type} ${size}`).toEqual({ ok: false, error: LOGO_FILE_ERROR });
    expect(LOGO_FILE_ERROR).toBe("Use a PNG or JPEG under 1 MB");
  });

  test("C3309: a logoPath is accepted when empty or a png or jpg key of the caller's own org, and refused otherwise", () => {
    expect(isOwnLogoPath(ORG, "")).toBe(true);
    expect(isOwnLogoPath(ORG, `${ORG}/${ID}.png`)).toBe(true);
    expect(isOwnLogoPath(ORG, `${ORG}/${ID}.jpg`)).toBe(true);
    const refused = [
      `6f1c2f0e-0000-4000-8000-000000000002/${ID}.png`,
      `${ORG}/logo.png`,
      `${ORG}/${ID}.svg`,
      `/${ORG}/${ID}.png`,
      `${ORG}/nested/${ID}.png`,
      `${ORG}/${ID}.png `,
    ];
    for (const path of refused) expect(isOwnLogoPath(ORG, path), path).toBe(false);
    expect(logoKey(ORG, ID, "jpg")).toBe(`${ORG}/${ID}.jpg`);
  });

  test("C3337: the public URL is <base>/storage/v1/object/public/logos/<path>, and null for no path", () => {
    expect(logoPublicUrl("https://x.supabase.co", `${ORG}/${ID}.png`)).toBe(`https://x.supabase.co/storage/v1/object/public/logos/${ORG}/${ID}.png`);
    expect(logoPublicUrl("https://x.supabase.co/", `${ORG}/${ID}.png`)).toBe(`https://x.supabase.co/storage/v1/object/public/logos/${ORG}/${ID}.png`);
    expect(logoPublicUrl("https://x.supabase.co", null)).toBeNull();
  });

  test("a PNG and a JPEG signature are told apart, anything else is null", () => {
    expect(logoFormat(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))).toBe("png");
    expect(logoFormat(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("jpg");
    expect(logoFormat(new Uint8Array([0x3c, 0x73, 0x76, 0x67]))).toBeNull();
    expect(logoFormat(new Uint8Array([]))).toBeNull();
  });
});
