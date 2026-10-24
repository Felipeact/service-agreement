import { describe, expect, test } from "vitest";
import { FOOTER_NAV, MAIN_NAV } from "./nav-items";

const hrefOf = (label: string) => [...MAIN_NAV, ...FOOTER_NAV].find((item) => item.label === label)?.href;

describe("navigation", () => {
  test.each([
    ["Pipeline", "/pipeline"],
    ["Customers", "/customers"],
    ["Settings", "/settings"],
  ])("C156: %s links to %s", (label, href) => {
    expect(hrefOf(label)).toBe(href);
  });

  test.each(["Agreements", "Sites & equipment", "Imports", "Task library"])("C156: %s has no page yet", (label) => {
    expect([...MAIN_NAV, ...FOOTER_NAV].some((item) => item.label === label)).toBe(true);
    expect(hrefOf(label)).toBeUndefined();
  });
});
