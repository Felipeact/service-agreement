// @vitest-environment jsdom
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { createElement, type ComponentType, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

vi.mock("@/composition", () => ({ getContainer: vi.fn(), getBillingContainer: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => "/", useRouter: () => ({ refresh: () => {} }), useSearchParams: () => new URLSearchParams() }));

/**
 * The owner's mockups in docs/ are the design and copy source for these pages (decided 2026-11-22: exact copy). Each page
 * is rendered here and its visible text, run by run and in order, is compared with the mockup's. Anything the page says
 * that the mockup does not, or the other way round, fails, so a later edit cannot drift from the design unnoticed.
 */
const DOCS = path.join(__dirname, "..", "..", "docs");

/** Every visible run of text, in order, with the text nodes React splits ("5", "seats") joined back together. */
function textRuns(html: string): string[] {
  const body = new DOMParser().parseFromString(html, "text/html").body;
  body.querySelectorAll("script,style,noscript,link,meta,title,canvas").forEach((element) => element.remove());
  const runs: string[] = [];
  const walk = (node: Element) => {
    let buffer = "";
    const flush = () => {
      const text = buffer.replace(/\s+/g, " ").trim();
      if (text) runs.push(text);
      buffer = "";
    };
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === 3) buffer += child.textContent ?? "";
      else if (child.nodeType === 1) {
        flush();
        walk(child as Element);
      }
    }
    flush();
  };
  walk(body);
  return runs;
}

/** Runs only one side has, found with a longest-common-subsequence walk so each is reported where it falls. */
function difference(expected: string[], actual: string[]) {
  const n = expected.length;
  const m = actual.length;
  const table = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) table[i][j] = expected[i] === actual[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
  const missing: string[] = [];
  const extra: string[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (expected[i] === actual[j]) {
      i++;
      j++;
    } else if (table[i + 1][j] >= table[i][j + 1]) missing.push(expected[i++]);
    else extra.push(actual[j++]);
  }
  while (i < n) missing.push(expected[i++]);
  while (j < m) extra.push(actual[j++]);
  return { missing, extra };
}

type Case = {
  mockup: string;
  render: () => Promise<ReactElement>;
  /** Runs the mockup shows as a demonstration of a state the live page shows only when it is true. */
  conditional?: string[];
  /** Runs the page adds on purpose and the mockup never had (the monthly/annual switch). */
  extra?: string[];
};

const fromPage = (load: () => Promise<{ default: ComponentType }>) => async () => createElement((await load()).default);

const CASES: Record<string, Case> = {
  "/ (home)": { mockup: "service_pacts_home_light_redesign", render: fromPage(() => import("./page")) },
  "/product": { mockup: "service_pacts_product_elevated_animated", render: fromPage(() => import("./product/page")) },
  "/pricing": { mockup: "service_pacts_pricing", render: fromPage(() => import("./pricing/page")) },
  "/demo": { mockup: "service_pacts_demo", render: fromPage(() => import("./demo/page")) },
  "/trades": { mockup: "service_pacts_trades", render: fromPage(() => import("./trades/page")) },
  "404": { mockup: "service_pacts_404_not_found", render: fromPage(() => import("./not-found")) },
  "/register": {
    mockup: "service_pacts_register",
    extra: ["Monthly", "Annual", "-20%"],
    render: async () => {
      const { Content } = await import("./register/_components/content");
      const { RegisterFields } = await import("./register/register-fields");
      return createElement(Content, { form: createElement(RegisterFields, { state: { status: "idle" }, pending: false }) });
    },
  },
  "/login": {
    mockup: "service_pacts_sign_in_animated_split_1",
    render: async () => {
      const { Content } = await import("./login/_components/content");
      const { LoginFields } = await import("./login/login-fields");
      return createElement(Content, { form: createElement(LoginFields, { state: { status: "idle" }, pending: false, linkInvalid: false }) });
    },
    // The mockup shows its expired-link alert and its "link sent" banner permanently; the live page shows them when they are true.
    conditional: [
      "info",
      "Sign-in link expired or consumed.",
      "Please enter your email below to receive a new one.",
      "close",
      "mark_email_read",
      "Sign-in link sent! Check your inbox to finish signing in.",
    ],
  },
};

describe.skipIf(!existsSync(DOCS))("pages match the owner's mockups, text for text", () => {
  test.each(Object.entries(CASES))("%s", async (_route, { mockup, render, conditional = [], extra: allowedExtra = [] }) => {
    const expected = textRuns(readFileSync(path.join(DOCS, mockup, "code.html"), "utf8"));
    const actual = textRuns(renderToStaticMarkup(await render()));
    const { missing, extra } = difference(expected, actual);
    expect(missing.filter((run) => !conditional.includes(run)), "text in the mockup but not on the page").toEqual([]);
    expect(extra.filter((run) => !allowedExtra.includes(run)), "text on the page but not in the mockup").toEqual([]);
    expect(actual.length).toBeGreaterThan(30);
  });
});
