import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { portalView } from "@/application/portal-view.testing";
import { ReviewView } from "./review-view";

const URL = "https://x.supabase.co/storage/v1/object/public/logos/o/l.png";
const actions = { decide: async () => ({ status: "idle" as const }), record: async () => undefined };
const render = (logoUrl?: string | null) => renderToStaticMarkup(createElement(ReviewView, { token: "t", view: portalView(), state: "open", actions, logoUrl }));

describe("the review page, logo", () => {
  test("C3334: with a logo URL the header holds an <img> of it with the company name as alt, before the name, and with none there is no <img>", () => {
    const withLogo = render(URL);
    expect(withLogo).toMatch(/<img[^>]*src="https:\/\/x\.supabase\.co\/storage\/v1\/object\/public\/logos\/o\/l\.png"/);
    expect(withLogo).toContain('alt="Kettle Ridge Mechanical Ltd."');
    expect(withLogo.indexOf("<img")).toBeLessThan(withLogo.indexOf("Kettle Ridge Mechanical Ltd.</p>"));
    expect(render()).not.toContain("<img");
    expect(render(null)).not.toContain("<img");
  });

  test("C3334: the rest of the page is the same with and without the logo", () => {
    expect(render(URL).replace(/<img[^>]*>/, "").replace(/<link rel="preload"[^>]*>/, "")).toBe(render());
  });
});
