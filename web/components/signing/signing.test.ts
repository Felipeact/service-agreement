import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { ViewSigningResult } from "@/application/use-cases";
import { CLOSED_MESSAGE, SIGNED_MESSAGE, SigningView, UNAVAILABLE_MESSAGE } from "./signing-view";
import { SigningForm, SigningFormEmbed } from "./signing-form";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
// The embedded form is DocuSeal's; here it is a marker that carries the props the component passes.
vi.mock("@docuseal/react", () => ({
  DocusealForm: (props: { src: string; onComplete?: () => void }) =>
    createElement("div", { "data-docuseal-form": props.src, "data-on-complete": String(typeof props.onComplete === "function") }),
}));

const EMBED = "https://docuseal.com/s/customer";
const TENANT = { name: "Kettle Ridge Mechanical Ltd.", address: "100 Sample Street, Burnaby, BC", phone: "604-555-0100", accent: "#1f6f8b" };

type Shown = Exclude<NonNullable<ViewSigningResult>, { state: "unavailable" }>;
const shown = (over: Partial<Shown> = {}): Shown => ({
  state: "open",
  tenant: TENANT,
  agreementNumber: "AG-1052",
  signerName: "Pat Lee",
  embedSrc: EMBED,
  ...over,
});
const html = (result: NonNullable<ViewSigningResult>) => renderToStaticMarkup(createElement(SigningView, { result }));

beforeEach(() => {
  refresh.mockClear();
});

describe("the signing page", () => {
  test("C1704: in the open state it shows the tenant, its colour, the contract number, the signer and the embedded form with a completion handler", () => {
    const markup = html(shown());
    expect(markup).toContain("Kettle Ridge Mechanical Ltd.");
    expect(markup).toContain("100 Sample Street, Burnaby, BC");
    expect(markup).toContain("604-555-0100");
    expect(markup).toMatch(/data-accent-rule[^>]*background-color:\s*#1f6f8b/i);
    expect(markup).toContain("Contract AG-1052");
    expect(markup).toContain("Signer: Pat Lee");
    // The form is created in the browser only (see "the embedded form"): the server HTML holds its box, not its element.
    expect(markup).toContain("Loading the signing form");
    expect(markup).toContain("aria-busy");
  });

  test("C1704: it offers no Send, Accept or Refuse control and names no product", () => {
    const markup = html(shown());
    expect(markup).not.toMatch(/Send|Accept|Refuse|<button/);
  });

  test("C1704: a tenant with no accent or an invalid one gets the neutral colour, and no tenant says the company", () => {
    expect(html(shown({ tenant: { ...TENANT, accent: "not-a-colour" } }))).toMatch(/data-accent-rule/);
    expect(html(shown({ tenant: null }))).toContain("the company");
  });

  test("C1705: the signed state says so and shows no form", () => {
    const markup = html(shown({ state: "signed", embedSrc: null }));
    expect(markup).toContain(SIGNED_MESSAGE);
    expect(SIGNED_MESSAGE).toBe("You have signed this contract.");
    expect(markup).not.toContain("data-docuseal-form");
  });

  test("C1705: the closed state says so and shows no form", () => {
    const markup = html(shown({ state: "closed", embedSrc: null }));
    expect(markup).toContain(CLOSED_MESSAGE);
    expect(CLOSED_MESSAGE).toBe("This contract is no longer open for signature.");
    expect(markup).not.toContain("data-docuseal-form");
  });

  test("C1705: the unavailable state says the link is not working right now, names no tenant and shows no form", () => {
    const markup = html({ state: "unavailable" });
    expect(markup).toContain(UNAVAILABLE_MESSAGE);
    expect(UNAVAILABLE_MESSAGE).toBe("This link is not working right now.");
    expect(markup).not.toContain("data-docuseal-form");
    expect(markup).not.toContain("Kettle Ridge");
  });
});

describe("the embedded form", () => {
  test("C1704: the server HTML holds no DocuSeal element, only a placeholder, so the provider's element connects once, in the browser", () => {
    const markup = renderToStaticMarkup(createElement(SigningForm, { src: EMBED }));
    expect(markup).not.toContain("data-docuseal-form");
    expect(markup).toContain("Loading the signing form");
  });

  test("C1704: once mounted the form is DocuSeal's, with the address it was given and a completion handler", () => {
    const element = SigningFormEmbed({ src: EMBED }) as ReactElement<{ onComplete: unknown; src: string }>;
    expect(element.props.src).toBe(EMBED);
    expect(typeof element.props.onComplete).toBe("function");
  });
});

describe("completing the form", () => {
  test("C1706: the completion handler refreshes the route once and nothing else", () => {
    const element = SigningFormEmbed({ src: EMBED }) as ReactElement<{ onComplete: () => unknown; src: string }>;
    expect(element.props.src).toBe(EMBED);
    expect(refresh).not.toHaveBeenCalled();
    expect(element.props.onComplete()).toBeUndefined();
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  test("C1706: no file under components/signing imports a server action or anything under app/", () => {
    const files = readdirSync(__dirname).filter((name) => /\.tsx?$/.test(name) && !name.endsWith(".test.ts"));
    expect(files.length).toBeGreaterThanOrEqual(2);
    for (const name of files) {
      const source = readFileSync(path.join(__dirname, name), "utf8");
      expect(source, name).not.toMatch(/from "@\/app\/|from "(\.\.\/)+app\/|\/actions"/);
      expect(source, name).not.toContain('"use server"');
    }
  });
});
