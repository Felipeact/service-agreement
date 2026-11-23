import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import { EquipmentPicker, pickedItems, pickedTotal } from "./pick-list";

const TYPES = [
  { id: "t-rtu", code: "RTU", name: "Rooftop Unit (RTU)" },
  { id: "t-boiler", code: "BLR", name: "Boiler" },
];
const render = (picked: Record<string, number>) => renderToStaticMarkup(createElement(EquipmentPicker, { types: TYPES, picked, onChange: vi.fn() }));

const resetButton = (html: string) => html.match(/<button[^>]*>Reset list</)?.[0] ?? "";

describe("pick by hand", () => {
  test("totals and lists only the types with units", () => {
    expect(pickedTotal({ "t-rtu": 2, "t-boiler": 1 })).toBe(3);
    expect(pickedItems({ "t-rtu": 2, "t-boiler": 0 })).toEqual([{ assetTypeId: "t-rtu", quantity: 2 }]);
  });

  test("nothing picked says so, offers only More, and Reset list is off", () => {
    const html = render({});
    expect(html).toContain("No units selected");
    expect(html).toContain('aria-label="More Boiler"');
    expect(html).not.toContain('aria-label="Fewer Boiler"');
    expect(resetButton(html)).toMatch(/\sdisabled=""/);
  });

  test("a picked type shows its quantity with Fewer and More, and the count in the header", () => {
    const html = render({ "t-rtu": 2 });
    expect(html).toContain("2 units selected");
    expect(html).toContain("Qty: 2");
    expect(html).toContain('aria-label="Fewer Rooftop Unit (RTU)"');
    expect(resetButton(html)).not.toMatch(/\sdisabled=""/);
  });

  test("More stops at 99 for a type", () => {
    const more = render({ "t-rtu": 99 }).match(/<button[^>]*aria-label="More Rooftop Unit \(RTU\)"[^>]*>/)?.[0] ?? "";
    expect(more).toMatch(/\sdisabled=""/);
  });
});
