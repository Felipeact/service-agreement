import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import type { ScopeControl, UncoveredType } from "@/domain/agreement";
import { ScopeControls } from "./scope-controls";
import { SendPrompt } from "./link-controls";
import { ServiceScopeSections } from "./service-scope";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }), usePathname: () => "/agreements" }));

const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;|&apos;/g, "'").replace(/\s+/g, " ").trim();

const CONTROLS: ScopeControl[] = [
  { assetId: "a1", typeCode: "RTU", typeName: "Rooftop unit", unitNo: "RTU-1", typeModel: null, location: "Roof", excluded: false },
  { assetId: "a2", typeCode: "RTU", typeName: "Rooftop unit", unitNo: "RTU-2", typeModel: null, location: null, excluded: true },
];
const UNCOVERED: UncoveredType[] = [{ code: "BOILER", name: "Boiler", assetCount: 2 }];
const setExcluded = vi.fn();

const scope = (props: Partial<Parameters<typeof ScopeControls>[0]> = {}) =>
  renderToStaticMarkup(createElement(ScopeControls, { controls: CONTROLS, uncovered: UNCOVERED, setExcluded, ...props }));

describe("the Scope panel", () => {
  test("C6013: a writer gets Leave out on an included unit and Include on an excluded one, each a button of its own", () => {
    const html = scope();
    expect(html).toMatch(/<button type="button"[^>]*aria-label="Leave out RTU-1 · Roof"[^>]*>Leave out<\/button>/);
    expect(html).toMatch(/<button type="button"[^>]*aria-label="Include RTU-2"[^>]*>Include<\/button>/);
    expect(text(html)).toContain("Rooftop unit, 1 unit in scope of 2");
    expect(text(html)).toContain("Left out");
  });

  test("C6013: a viewer sees the lists and no buttons", () => {
    const html = scope({ setExcluded: undefined });
    expect(html).not.toContain("<button");
    expect(text(html)).toContain("RTU-1");
  });

  test("C6013: the types no line covers are named, with their counts and the way in", () => {
    expect(text(scope())).toContain("Not covered by any service line, so not in this agreement: Boiler (2)");
  });

  test("C6013: a frozen version never gets the panel: nothing is rendered without controls or uncovered types", () => {
    expect(scope({ controls: [], uncovered: [] })).toBe("");
  });

  test("C6009: with no covered unit the panel says no equipment is covered until a service line is added", () => {
    expect(text(scope({ controls: [] }))).toContain("No equipment is covered until you add a service line.");
  });
});

describe("the scope sections of a draft with no line", () => {
  test("C6009: a site with equipment but no line reads 'No equipment is covered until you add a service line.', not 'on this site yet'", () => {
    const html = renderToStaticMarkup(createElement(ServiceScopeSections, { scope: { source: "live", takenAt: null, types: [] }, siteId: "s1", canAddEquipment: true, noLinesYet: true }));
    expect(text(html)).toContain("No equipment is covered until you add a service line.");
    expect(text(html)).not.toContain("on this site yet");
  });

  test("C6009: a site with no equipment at all still points to adding equipment", () => {
    const html = renderToStaticMarkup(createElement(ServiceScopeSections, { scope: { source: "live", takenAt: null, types: [] }, siteId: "s1", canAddEquipment: true }));
    expect(text(html)).toContain("No equipment on this site yet.");
  });
});

describe("the send dialog", () => {
  const prompt = (state: Parameters<typeof SendPrompt>[0]["state"]) =>
    renderToStaticMarkup(createElement(SendPrompt, { number: "AG-1052", confirming: true, pending: false, state, recipient: "a@b.ca" }));

  test("C6019: company_unconfirmed names each failing detail and links to /settings", () => {
    const html = prompt({ status: "company_unconfirmed", problems: ["legalName", "phone"] });
    expect(text(html)).toContain("Your company legal name, phone number");
    expect(html).toContain('href="/settings"');
    expect(text(html)).toContain("Fix it in Settings");
  });

  test("C6019: an unconfirmed company says to save the details once", () => {
    expect(text(prompt({ status: "company_unconfirmed", problems: ["unconfirmed"] }))).toContain("save them once to confirm");
  });

  test("C6010: needs_confirmation lists the uncovered types and turns Send into Send anyway with the confirm flag", () => {
    const html = prompt({ status: "needs_confirmation", uncovered: [{ code: "BOILER", name: "Boiler", assetCount: 2 }, { code: "CH", name: "Chiller", assetCount: 1 }] });
    expect(text(html)).toContain("2 equipment types have no service line.");
    expect(text(html)).toContain("Boiler (2), Chiller (1)");
    expect(html).toContain('name="confirmUncovered" value="yes"');
    expect(html).toMatch(/<button type="submit"[^>]*>Send anyway<\/button>/);
  });

  test("C6010: without the question there is no flag and the button says Send", () => {
    const html = prompt({ status: "idle" });
    expect(html).not.toContain("confirmUncovered");
    expect(html).toMatch(/<button type="submit"[^>]*>Send<\/button>/);
  });
});
