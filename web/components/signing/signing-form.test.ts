import { createElement, isValidElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

// In the browser, after hydration, `useSyncExternalStore` answers its client snapshot: mounted. The server snapshot (the
// first test of signing.test.ts) is the placeholder. Here the hook is pinned to the client answer, so the branch that only
// runs in a browser runs, and DocuSeal's element is a marker that carries the props it was given.
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useSyncExternalStore: () => true,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@docuseal/react", () => ({
  DocusealForm: (props: { src: string; email?: string; onComplete?: () => void }) =>
    createElement("div", { "data-docuseal-form": props.src, "data-email": props.email ?? "", "data-on-complete": String(typeof props.onComplete === "function") }),
}));

const { SigningForm, SigningFormEmbed } = await import("./signing-form");

const EMBED = "https://docuseal.com/s/customer";

describe("the signing form once it is mounted", () => {
  test("C1704: it renders DocuSeal's form with the address and the email it was given, and no placeholder", () => {
    const markup = renderToStaticMarkup(createElement(SigningForm, { src: EMBED, email: "dana@example.com" }));
    expect(markup).toContain(`data-docuseal-form="${EMBED}"`);
    expect(markup).toContain('data-email="dana@example.com"');
    expect(markup).toContain('data-on-complete="true"');
    expect(markup).not.toContain("Loading the signing form");
  });

  test("C1704: the mounted branch hands the same props on to the embed, whatever the address is", () => {
    for (const src of [EMBED, "https://docuseal.com/s/contractor"]) {
      const tree = SigningForm({ src, email: "x@example.com" }) as ReactElement<{ src: string; email?: string }>;
      expect(isValidElement(tree)).toBe(true);
      expect(tree.type).toBe(SigningFormEmbed);
      expect(tree.props).toEqual({ src, email: "x@example.com" });
    }
  });
});
