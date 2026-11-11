import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { createElement, isValidElement, type ReactElement, type ReactNode } from "react";
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

/** Every element of the given type in a React tree, found by walking props.children and calling function components once. */
function elementsOf(node: ReactNode, type: unknown): ReactElement<{ src?: string }>[] {
  if (Array.isArray(node)) return node.flatMap((child) => elementsOf(child, type));
  if (!isValidElement(node)) return [];
  const element = node as ReactElement<{ children?: ReactNode; src?: string }>;
  const own = element.type === type ? [element as ReactElement<{ src?: string }>] : [];
  const children = elementsOf(element.props.children, type);
  if (typeof element.type === "function" && element.type !== type) {
    return [...own, ...children, ...elementsOf((element.type as (props: unknown) => ReactNode)(element.props), type)];
  }
  return [...own, ...children];
}

describe("the address that reaches the form", () => {
  test("C1704: in the open state the unsealed embed address is the form's src, and in the other states no form is created", () => {
    const open = elementsOf(SigningView({ result: shown() }), SigningForm);
    expect(open).toHaveLength(1);
    expect(open[0].props.src).toBe(EMBED);
    expect(elementsOf(SigningView({ result: shown({ embedSrc: "https://docuseal.com/s/other" }) }), SigningForm)[0].props.src).toBe("https://docuseal.com/s/other");
    for (const result of [shown({ state: "signed", embedSrc: null }), shown({ state: "closed", embedSrc: null }), { state: "unavailable" } as const]) {
      expect(elementsOf(SigningView({ result }), SigningForm)).toHaveLength(0);
    }
  });

  test("C1704: an open state with no address creates no form rather than one with an empty src", () => {
    expect(elementsOf(SigningView({ result: shown({ embedSrc: null }) }), SigningForm)).toHaveLength(0);
  });
});

describe("the signing page, logo", () => {
  const URL = "https://x.supabase.co/storage/v1/object/public/logos/o/l.png";

  test("C3335: with a logo URL the header holds an <img> of it with the company name as alt, and with none there is no <img>", () => {
    const withLogo = renderToStaticMarkup(createElement(SigningView, { result: shown(), logoUrl: URL }));
    expect(withLogo).toMatch(/<img[^>]*src="https:\/\/x\.supabase\.co\/storage\/v1\/object\/public\/logos\/o\/l\.png"/);
    expect(withLogo).toContain('alt="Kettle Ridge Mechanical Ltd."');
    expect(withLogo.indexOf("<img")).toBeLessThan(withLogo.indexOf("Kettle Ridge Mechanical Ltd.</p>"));
    expect(html(shown())).not.toContain("<img");
    expect(renderToStaticMarkup(createElement(SigningView, { result: shown(), logoUrl: null }))).not.toContain("<img");
  });

  test("C3335: the rest of the header is the same with and without the logo", () => {
    const strip = (markup: string) => markup.replace(/<img[^>]*>/, "").replace(/<link rel="preload"[^>]*>/, "");
    expect(strip(renderToStaticMarkup(createElement(SigningView, { result: shown(), logoUrl: URL })))).toBe(html(shown()));
  });
});

