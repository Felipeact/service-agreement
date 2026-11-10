import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import SetupError from "./error";

const webRoot = path.resolve(__dirname, "..", "..");
const read = (relative: string) => readFileSync(path.join(webRoot, relative), "utf8");

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sources(full);
    return /\.(ts|tsx)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

/** Built so this file does not match its own search. */
const REDIRECT_TO_SETUP = /redirect\(\s*["'`]\/setup["'`]\s*\)/;

describe("who redirects to /setup", () => {
  test("C2805: only the Pipeline page redirects to /setup", () => {
    const hits = [...sources(path.join(webRoot, "app")), ...sources(path.join(webRoot, "components"))]
      .filter((file) => REDIRECT_TO_SETUP.test(readFileSync(file, "utf8")))
      .map((file) => path.relative(webRoot, file).replaceAll("\\", "/"));
    expect(hits).toEqual(["app/(app)/pipeline/page.tsx"]);
  });
});

describe("the setup screen's failure states", () => {
  test("C2819: the page has a loading state and an error state whose button resets", () => {
    expect(() => read("app/setup/loading.tsx")).not.toThrow();
    const markup = renderToStaticMarkup(createElement(SetupError, { error: new Error("x"), reset: () => {} }));
    expect(markup).toContain("Try again");
    expect(read("app/setup/error.tsx")).toMatch(/onClick=\{\(\) => reset\(\)\}/);
  });

  test("C2819: the page only reads: it never calls a store write, so a failed read stamps nothing", () => {
    const page = read("app/setup/page.tsx");
    expect(page).not.toMatch(/saveSetupProfile|skipSetup/);
    expect(page).toMatch(/setupCatalog\(\)/);
  });
});
