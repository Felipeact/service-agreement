import type { ReactElement } from "react";
import { describe, expect, test, vi } from "vitest";

// The form's one hook is replaced so the function its action runs can be called; everywhere else it calls through to React.
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, useActionState: vi.fn(actual.useActionState) };
});

const react = await import("react");
const { NewAgreementForm } = await import("./new-agreement-form");

const SITE = "00000000-0000-4000-8000-0000000000aa";
const VERSION = "77777777-7777-4777-8777-777777777777";

/** Renders the form as a function, and returns what its form action does with a submitted site. */
async function submit(template?: { versionId: string; name: string }) {
  const create = vi.fn(async () => ({ status: "idle" as const }));
  vi.mocked(react.useActionState).mockImplementationOnce(((fn: unknown) => [{ status: "idle" }, fn, false]) as never);
  const element = NewAgreementForm({ sites: [], create, template }) as ReactElement<{ action: (state: unknown, formData: FormData) => Promise<unknown> }>;
  const data = new FormData();
  data.set("siteId", SITE);
  await element.props.action({ status: "idle" }, data);
  return create;
}

describe("the New agreement form with a template", () => {
  test("C5357: choosing a site passes the template's version to the create action with it", async () => {
    const create = await submit({ versionId: VERSION, name: "Quarterly HVAC" });
    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith(SITE, VERSION);
  });

  test("C5357: without a template the create action gets the site alone, as before", async () => {
    const create = await submit();
    expect(create).toHaveBeenCalledWith(SITE);
  });
});
