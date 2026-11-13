import { afterEach, describe, expect, test, vi } from "vitest";
import { makeTenantLogo } from "./tenant-logo";

const ORG = "11111111-1111-4111-8111-111111111111";
const PATH = `${ORG}/33333333-3333-4333-8333-333333333333.png`;
const LOGO = { bytes: new Uint8Array([1, 2, 3]), format: "png" as const };

afterEach(() => vi.restoreAllMocks());

describe("the logo a document draws", () => {
  test("C3330: it loads the bytes of the path stored for that org, and a replaced path loads the new one", async () => {
    const stored = new Map([[ORG, PATH]]);
    const current = vi.fn(async (orgId: string) => stored.get(orgId) ?? null);
    const load = vi.fn(async (path: string | null) => (path ? { ...LOGO, bytes: new TextEncoder().encode(path) } : null));
    const tenantLogo = makeTenantLogo({ current, load });

    expect((await tenantLogo(ORG))?.bytes).toEqual(new TextEncoder().encode(PATH));
    expect(current).toHaveBeenCalledWith(ORG);
    const replaced = `${ORG}/44444444-4444-4444-8444-444444444444.jpg`;
    stored.set(ORG, replaced);
    await tenantLogo(ORG);
    expect(load).toHaveBeenLastCalledWith(replaced);
  });

  test("an org with no stored path loads nothing", async () => {
    const load = vi.fn(async () => null);
    expect(await makeTenantLogo({ current: async () => null, load })("o")).toBeNull();
    expect(load).toHaveBeenCalledWith(null);
  });

  test("a failing read gives null and one log line, and a failing load too", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await makeTenantLogo({ current: async () => { throw new Error("down"); }, load: async () => LOGO })(ORG)).toBeNull();
    expect(await makeTenantLogo({ current: async () => PATH, load: async () => { throw new Error("boom"); } })(ORG)).toBeNull();
    expect(error).toHaveBeenCalledTimes(2);
  });
});
