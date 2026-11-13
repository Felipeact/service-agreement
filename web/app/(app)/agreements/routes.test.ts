import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const WEB = path.resolve(__dirname, "../../..");

/** Every file under `dir` (relative to web/), skipping tests and dependencies. */
function sources(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(path.join(WEB, dir))) {
    const relative = `${dir}/${name}`;
    if (name === "node_modules" || name === ".next") continue;
    if (statSync(path.join(WEB, relative)).isDirectory()) out.push(...sources(relative));
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name)) out.push(relative);
  }
  return out;
}

describe("the removed /agreements/new page", () => {
  test("C5413: the page, its loading file and the NewAgreementForm component no longer exist, so the route answers 404", () => {
    expect(existsSync(path.join(WEB, "app/(app)/agreements/new/page.tsx"))).toBe(false);
    expect(existsSync(path.join(WEB, "app/(app)/agreements/new/loading.tsx"))).toBe(false);
    expect(existsSync(path.join(WEB, "app/(app)/agreements/new"))).toBe(false);
    expect(existsSync(path.join(WEB, "components/agreements/new-agreement-form.tsx"))).toBe(false);
    // `/agreements/new` would otherwise be read as an agreement id by the dynamic segment, which answers 404 for a non-UUID.
    expect(existsSync(path.join(WEB, "app/(app)/agreements/[agreementId]/page.tsx"))).toBe(true);
  });

  test("C5414: no non-test source under app, components, application or domain points at /agreements/new", () => {
    // A path that merely starts with the same letters, such as components/agreements/new-agreement-dialog, is not the route.
    const route = /\/agreements\/new(?![\w-])/;
    const files = ["app", "components", "application", "domain"].flatMap(sources);
    expect(files.length).toBeGreaterThan(100);
    const offenders = files.filter((file) => route.test(readFileSync(path.join(WEB, file), "utf8")));
    expect(offenders).toEqual([]);
  });
});
