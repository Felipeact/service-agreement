import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

const ROOT = __dirname;

/** Every directory under the templates routes, the routes' own folder included. */
function directories(dir: string): string[] {
  return [dir, ...readdirSync(dir).map((name) => path.join(dir, name)).filter((entry) => statSync(entry).isDirectory()).flatMap(directories)];
}

describe("the loading screens of the Templates routes", () => {
  test("C5423: every route directory under templates that has a page also has a loading screen", () => {
    const withPage = directories(ROOT).filter((dir) => existsSync(path.join(dir, "page.tsx")));
    // /templates, /templates/new and /templates/[templateId].
    expect(withPage.map((dir) => path.relative(ROOT, dir).replace(/\\/g, "/") || ".").sort()).toEqual([".", "[templateId]", "new"]);
    const missing = withPage.filter((dir) => !existsSync(path.join(dir, "loading.tsx"))).map((dir) => path.relative(ROOT, dir) || ".");
    expect(missing).toEqual([]);
  });

  const screens: Record<string, () => Promise<{ default: () => ReactElement }>> = {
    new: () => import("./new/loading"),
    "[templateId]": () => import("./[templateId]/loading"),
    ".": () => import("./loading"),
  };

  test.each([
    ["new", "New template"],
    ["[templateId]", "Edit template"],
    [".", "Agreement templates"],
  ])("C5423: the loading screen of %s names the page %s and says it is loading", async (dir, title) => {
    const { default: Loading } = await screens[dir]();
    const html = renderToStaticMarkup(createElement(Loading));
    expect(html).toContain(title);
    expect(html).toContain("Loading");
  });
});
