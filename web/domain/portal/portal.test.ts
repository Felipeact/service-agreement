import { describe, expect, test } from "vitest";
import { isPortalToken, portalLinkUrl } from "./index";

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
