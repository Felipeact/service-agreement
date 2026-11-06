import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import SignError from "./error";

describe("the signing page's error boundary", () => {
  test("C1726: it shows one alert with a way to retry, and names no tenant, contract or product", () => {
    const markup = renderToStaticMarkup(createElement(SignError, { error: new Error("secret detail"), reset: () => {} }));
    expect(markup.match(/role="alert"/g)).toHaveLength(1);
    expect(markup).toContain("Something went wrong. Try again, or contact the company that sent this link.");
    expect(markup).toContain("Try again");
    expect(markup).not.toContain("secret detail");
    expect(markup).not.toMatch(/AG-|Service Agreement/);
  });

  test("C1726: the retry button calls reset once", () => {
    const reset = vi.fn();
    const tree = SignError({ error: new Error("x"), reset }) as ReactElement<{ children: ReactElement<{ onClick?: () => void }>[] }>;
    const button = (tree.props.children as ReactElement<{ onClick?: () => void }>[]).find((child) => typeof child.props.onClick === "function");
    expect(button).toBeDefined();
    button!.props.onClick!();
    expect(reset).toHaveBeenCalledTimes(1);
  });
});
