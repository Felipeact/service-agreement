import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import { TemplatePicker } from "./template-picker";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }), usePathname: () => "/agreements" }));

const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;|&apos;/g, "'").replace(/\s+/g, " ").trim();
const CHOICES = [
  { versionId: "v-std", name: "Standard agreement" },
  { versionId: "v-hvac", name: "Quarterly HVAC" },
];
const change = vi.fn();
const render = (props: Partial<Parameters<typeof TemplatePicker>[0]> = {}) => renderToStaticMarkup(createElement(TemplatePicker, { name: "Quarterly HVAC", ...props }));

describe("the template on the agreement page", () => {
  test("C7109: the name is shown with the label Template, with or without a choice", () => {
    expect(text(render())).toContain("Template: Quarterly HVAC");
    expect(text(render({ name: "Standard agreement" }))).toContain("Template: Standard agreement");
  });

  test("C7110: a writer on an editable version gets every template offered, the current one selected, and a Change template button", () => {
    const html = render({ choices: CHOICES, selectedVersionId: "v-hvac", change });
    expect(html).toContain('<option value="v-std">Standard agreement</option>');
    expect(html).toMatch(/<option value="v-hvac"[^>]*selected[^>]*>Quarterly HVAC<\/option>|<option[^>]*selected[^>]*value="v-hvac"[^>]*>Quarterly HVAC<\/option>/);
    expect(html).toMatch(/<button[^>]*>Change template<\/button>/);
    expect(text(html)).toContain("Your service lines, term and scope stay as they are.");
  });

  test.each([
    ["a viewer (no action)", { choices: CHOICES, selectedVersionId: "v-hvac" }],
    ["a version that cannot change (no choices)", { change }],
    ["an empty list of choices", { choices: [], change }],
  ])("C7110: %s sees the name only", (_label, props) => {
    const html = render(props);
    expect(html).not.toContain("<select");
    expect(html).not.toContain("Change template");
    expect(text(html)).toContain("Template: Quarterly HVAC");
  });
});
