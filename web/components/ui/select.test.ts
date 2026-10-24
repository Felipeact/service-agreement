import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { Select } from "./select";
import { TextInput } from "./text-input";

const render = (error?: string) =>
  renderToStaticMarkup(createElement(Select, { id: "province", label: "Governing province", error }, createElement("option", { value: "BC" }, "BC")));

const classOf = (tag: string) => tag.match(/class="([^"]*)"/)?.[1] ?? "";

describe("Select", () => {
  test("C153: a labelled native select with no invalid state and TextInput's heights", () => {
    const html = render();
    expect(html).toMatch(/<label[^>]*for="province"[^>]*>Governing province</);
    const select = html.match(/<select[^>]*>/)?.[0] ?? "";
    expect(select).toContain('id="province"');
    expect(select).not.toContain("aria-invalid");

    const input = renderToStaticMarkup(createElement(TextInput, { id: "x", label: "X" })).match(/<input[^>]*>/)?.[0] ?? "";
    const heights = (tag: string) => classOf(tag).split(" ").filter((name) => /^(lg:)?h-/.test(name));
    expect(heights(select)).toEqual(heights(input));
  });

  test("C153: an error marks it invalid, links the message under it and turns the border Danger", () => {
    const html = render("Choose a province or territory from the list");
    const select = html.match(/<select[^>]*>/)?.[0] ?? "";
    expect(select).toContain('aria-invalid="true"');
    expect(select).toContain('aria-describedby="province-error"');
    expect(classOf(select).split(" ")).toContain("border-danger");
    expect(html.slice(html.indexOf('id="province-error"'))).toMatch(/^id="province-error"[^>]*>Choose a province/);
  });
});
