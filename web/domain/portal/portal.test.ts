import { describe, expect, test } from "vitest";
import { contrastText, isAccent, isPortalToken, portalLinkUrl, portalState, type PortalState, type PortalStateInput } from "./index";

describe("portal link address", () => {
  test("C901: the URL is the base, /review/ and the token, with no doubled slash", () => {
    const token = "A".repeat(43);
    expect(portalLinkUrl("https://app.example.com", token)).toBe(`https://app.example.com/review/${token}`);
    expect(portalLinkUrl("https://app.example.com/", token)).toBe(`https://app.example.com/review/${token}`);
  });

  test.each([
    ["a 43 character base64url token", "A".repeat(42) + "_", true],
    ["42 characters", "A".repeat(42), false],
    ["44 characters", "A".repeat(44), false],
    ["a plus sign", "A".repeat(42) + "+", false],
    ["a space", "A".repeat(42) + " ", false],
    ["empty", "", false],
  ])("C910: %s", (_name, value, expected) => {
    expect(isPortalToken(value)).toBe(expected);
  });
});

describe("portalState", () => {
  const live = { revoked: false, current: true };
  const old = { revoked: false, current: false };
  const revoked = { revoked: true, current: true };

  test.each<[string, PortalStateInput, PortalState]>([
    ["live + current + sent", { link: live, status: "sent" }, "open"],
    ["current + accepted", { link: live, status: "accepted" }, "decided"],
    ["current + refused", { link: live, status: "refused" }, "decided"],
    ["current + changes_requested", { link: live, status: "changes_requested" }, "decided"],
    ["older version + sent", { link: old, status: "sent" }, "superseded"],
    ["older version + accepted", { link: old, status: "accepted" }, "superseded"],
    ["older version + draft", { link: old, status: "draft" }, "superseded"],
    ["revoked + sent", { link: revoked, status: "sent" }, "replaced"],
    ["revoked + accepted", { link: revoked, status: "accepted" }, "replaced"],
    ["revoked + withdrawn on an older version", { link: { revoked: true, current: false }, status: "withdrawn" }, "replaced"],
    ["withdrawn", { link: live, status: "withdrawn" }, "withdrawn"],
    ["expired", { link: live, status: "expired" }, "expired"],
    ["no link", { link: null, status: "sent" }, "unknown"],
  ])("C908: %s -> %s", (_name, input, expected) => {
    expect(portalState(input)).toBe(expected);
  });
});

describe("contrastText", () => {
  const channel = (value: number) => {
    const v = value / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const lum = (hex: string) => {
    const n = (i: number) => channel(parseInt(hex.slice(i, i + 2), 16));
    return 0.2126 * n(1) + 0.7152 * n(3) + 0.0722 * n(5);
  };
  const ratio = (a: string, b: string) => {
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };

  test.each([
    ["#000000", "#ffffff"],
    ["#ffffff", null],
    ["#1f6f8b", "#ffffff"],
    ["#ffff00", null],
    ["#ff0000", null],
    ["#00ff00", null],
    ["#808080", null],
    ["#0000ff", "#ffffff"],
  ])("C913: %s reads at 4.5:1 or better", (accent, expected) => {
    const text = contrastText(accent);
    expect(ratio(accent, text)).toBeGreaterThanOrEqual(4.5);
    if (expected) expect(text).toBe(expected);
    else expect(["#ffffff", "#050505"]).toContain(text);
  });

  test("C913: every accent on a coarse grid reads at 4.5:1 or better", () => {
    for (let r = 0; r < 256; r += 51) for (let g = 0; g < 256; g += 51) for (let b = 0; b < 256; b += 51) {
      const accent = `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
      expect(ratio(accent, contrastText(accent))).toBeGreaterThanOrEqual(4.5);
    }
  });

  test("C912: only #rrggbb is an accent", () => {
    expect(isAccent("#1f6f8b")).toBe(true);
    expect(isAccent("red")).toBe(false);
    expect(isAccent("#fff")).toBe(false);
    expect(isAccent("url(x)")).toBe(false);
  });
});
