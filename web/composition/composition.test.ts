import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ getAll: () => [], set: () => {} }),
}));

const URL_KEY = "NEXT_PUBLIC_SUPABASE_URL";
const PUBLISHABLE_KEY = "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY";

function setEnv(url: string | undefined, key: string | undefined) {
  vi.stubEnv(URL_KEY, url as string);
  vi.stubEnv(PUBLISHABLE_KEY, key as string);
  if (url === undefined) delete process.env[URL_KEY];
  if (key === undefined) delete process.env[PUBLISHABLE_KEY];
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("composition root", () => {
  test("C22: index.ts starts with server-only and getContainer() wires the use cases and the clock", async () => {
    const source = readFileSync(path.join(__dirname, "index.ts"), "utf8");
    const firstStatement = source
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line !== "" && !line.startsWith("//") && !line.startsWith("/*") && !line.startsWith("*"));
    expect(firstStatement).toBe('import "server-only";');

    setEnv("https://example.supabase.co", "sb_publishable_test");
    const { getContainer } = await import("./index");
    const container = await getContainer();
    expect(typeof container.transitionAgreement).toBe("function");
    expect(typeof container.transitionContract).toBe("function");
    expect(container.clock.now()).toBeInstanceOf(Date);
  });

  test("C27: getContainer() wires the sign-in link, link verification, sign out and the current member", async () => {
    setEnv("https://example.supabase.co", "sb_publishable_test");
    const { getContainer } = await import("./index");
    const container = await getContainer();
    expect(typeof container.requestSignInLink).toBe("function");
    expect(typeof container.verifyEmailLink).toBe("function");
    expect(typeof container.signOut).toBe("function");
    expect(typeof container.currentMember).toBe("function");
  });

  test("C101: getContainer() exposes the readers and the settings store", async () => {
    setEnv("https://example.supabase.co", "sb_publishable_test");
    const { getContainer } = await import("./index");
    const container = await getContainer();
    for (const name of ["pipelineBoard", "listCustomers", "customerDetail", "siteRegister", "getOrgSettings", "saveOrgSettings"] as const) {
      expect(typeof container[name], name).toBe("function");
    }
  });

  test.each([
    [URL_KEY, undefined, "sb_publishable_test"],
    [PUBLISHABLE_KEY, "https://example.supabase.co", undefined],
  ])("C23: getContainer() names %s when it is unset", async (missing, url, key) => {
    setEnv(url, key);
    const { getContainer } = await import("./index");
    await expect(getContainer()).rejects.toThrow(missing);
  });
});
