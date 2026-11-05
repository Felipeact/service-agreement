import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { portalView } from "@/application/portal-view.testing";
import { ReviewView } from "./review-view";

const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/\s+/g, " ");

const open = (validUntil: string | null) =>
  text(
    renderToStaticMarkup(
      createElement(ReviewView, {
        token: "t",
        view: portalView({ validUntil }),
        state: "open",
        actions: { decide: async () => ({ status: "idle" as const }), record: async () => undefined },
      }),
    ),
  );

describe("the review page's validity date", () => {
  test("C1236: an open link shows its date, formatted from the text", () => {
    expect(open("2026-12-02")).toContain("Valid until Dec 2, 2026");
    const jan = open("2027-01-01");
    expect(jan).toContain("Valid until Jan 1, 2027");
    expect(jan).not.toContain("Dec 31, 2026");
  });

  test("C1236: no date, no line", () => {
    expect(open(null)).not.toContain("Valid until");
  });
});
