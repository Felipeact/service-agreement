import { describe, expect, test, vi } from "vitest";
import type { LogoUploadAnswer } from "@/app/logo-upload";
import { LOGO_UPLOAD_FAILED, uploadLogo } from "./logo-upload";

const PATH = "11111111-1111-4111-8111-111111111111/33333333-3333-4333-8333-333333333333.png";
const ok: LogoUploadAnswer = { ok: true, path: PATH, signedUrl: "https://s/sign?token=t", contentType: "image/png" };
const file = (type: string, size: number) => ({ type, size });

describe("the browser half of a logo upload", () => {
  test.each([
    ["an svg", file("image/svg+xml", 100)],
    ["a gif", file("image/gif", 100)],
    ["an empty file", file("image/png", 0)],
    ["a file of 1048577 bytes", file("image/png", 1048577)],
  ])("C3319: %s is refused with the rule's message and the server is never asked", async (_name, picked) => {
    const prepare = vi.fn();
    const put = vi.fn();
    expect(await uploadLogo(picked, { prepare, put })).toEqual({ ok: false, error: "Use a PNG or JPEG under 1 MB" });
    expect(prepare).not.toHaveBeenCalled();
    expect(put).not.toHaveBeenCalled();
  });

  test("a PNG is prepared, then PUT to the signed URL with the server's content type, and the new path comes back", async () => {
    const prepare = vi.fn(async () => ok);
    const put = vi.fn(async () => true);
    const picked = file("image/png", 500);
    expect(await uploadLogo(picked, { prepare, put })).toEqual({ ok: true, path: PATH });
    expect(prepare).toHaveBeenCalledWith({ type: "image/png", size: 500 });
    expect(put).toHaveBeenCalledWith("https://s/sign?token=t", picked, "image/png");
  });

  test("C3320: IF Storage refuses the bytes, or the PUT throws, THEN the result is 'Logo upload failed, try again' with no path", async () => {
    const refused = await uploadLogo(file("image/png", 500), { prepare: async () => ok, put: async () => false });
    expect(refused).toEqual({ ok: false, error: "Logo upload failed, try again" });
    const thrown = await uploadLogo(file("image/png", 500), { prepare: async () => ok, put: async () => { throw new Error("offline"); } });
    expect(thrown).toEqual({ ok: false, error: LOGO_UPLOAD_FAILED });
    expect(JSON.stringify([refused, thrown])).not.toContain(PATH);
  });

  test("C3320: IF the server refuses or its call throws THEN the result carries its message or the failure message, and nothing is sent to Storage", async () => {
    const put = vi.fn();
    expect(await uploadLogo(file("image/png", 500), { prepare: async () => ({ ok: false, error: "You don't have permission to change this." }), put })).toEqual({
      ok: false,
      error: "You don't have permission to change this.",
    });
    expect(await uploadLogo(file("image/png", 500), { prepare: async () => { throw new Error("500"); }, put })).toEqual({ ok: false, error: LOGO_UPLOAD_FAILED });
    expect(put).not.toHaveBeenCalled();
  });
});
