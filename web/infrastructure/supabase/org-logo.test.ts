import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { supabaseOrgLogo } from "./org-logo";
import { stubClient, type Reply, type StorageReply } from "./stub-client";

const ORG = "11111111-1111-4111-8111-111111111111";
const ID = "33333333-3333-4333-8333-333333333333";
const PATH = `${ORG}/${ID}.png`;
const BASE = "https://example.supabase.co";
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const JPG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2]);

const body = (bytes: Uint8Array, status = 200) => new Response(bytes as BodyInit, { status });

function logo(fetchImpl: unknown, storage: Record<string, StorageReply> = {}, tables: Record<string, Reply> = {}) {
  const stub = stubClient(tables, storage);
  return { ...stub, logo: supabaseOrgLogo(stub.typed, { baseUrl: BASE, fetch: fetchImpl as typeof fetch, newId: () => ID }) };
}

let error: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  error = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("OrgLogo.load", () => {
  test("C3328: a PNG and a JPEG body load with their format, from the public URL", async () => {
    const fetchImpl = vi.fn(async (url: RequestInfo | URL) => body(String(url).endsWith(".jpg") ? JPG : PNG));
    const { logo: l } = logo(fetchImpl);
    expect(await l.load(PATH)).toEqual({ bytes: PNG, format: "png" });
    expect(await l.load(`${ORG}/${ID}.jpg`)).toEqual({ bytes: JPG, format: "jpg" });
    expect(fetchImpl.mock.calls[0][0]).toBe(`${BASE}/storage/v1/object/public/logos/${PATH}`);
    expect(error).not.toHaveBeenCalled();
  });

  test("C3328: no path loads nothing and makes no request", async () => {
    const fetchImpl = vi.fn();
    const { logo: l } = logo(fetchImpl);
    expect(await l.load(null)).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test.each([
    ["a 404", () => body(PNG, 404)],
    ["a 500", () => body(PNG, 500)],
    ["bytes that are neither format", () => body(new Uint8Array([0x3c, 0x73, 0x76, 0x67, 0x3e]))],
    ["more than 1048576 bytes", () => body(new Uint8Array([...PNG, ...new Uint8Array(1048576)]))],
  ])("C3328: %s gives null and exactly one log line", async (_name, reply) => {
    const { logo: l } = logo(async () => reply());
    expect(await l.load(PATH)).toBeNull();
    expect(error).toHaveBeenCalledTimes(1);
  });

  test("C3328: a fetch still waiting after 3 seconds is given up on: null and one log line", async () => {
    vi.useFakeTimers();
    const hung = (_url: unknown, init?: RequestInit) =>
      new Promise((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(new Error("aborted"))));
    const { logo: l } = logo(hung);
    const pending = l.load(PATH);
    await vi.advanceTimersByTimeAsync(2999);
    expect(error).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(await pending).toBeNull();
    expect(error).toHaveBeenCalledTimes(1);
  });
});

describe("OrgLogo storage and row access", () => {
  test("a new key <orgId>/<uuid>.<ext> is signed in the logos bucket", async () => {
    const { logo: l, calls } = logo(vi.fn(), { createSignedUploadUrl: { data: { signedUrl: "https://s/sign?token=t", token: "t", path: PATH }, error: null } });
    expect(await l.prepareUpload(ORG, "png")).toEqual({ ok: true, path: PATH, signedUrl: "https://s/sign?token=t" });
    expect(await l.prepareUpload(ORG, "jpg")).toMatchObject({ ok: true, path: `${ORG}/${ID}.jpg` });
    expect(calls.filter((c) => c.table === "storage:logos" && c.method === "createSignedUploadUrl").map((c) => c.args[0])).toEqual([PATH, `${ORG}/${ID}.jpg`]);
  });

  test("a signing failure is {ok:false} and logged", async () => {
    const { logo: l } = logo(vi.fn(), { createSignedUploadUrl: { data: null, error: { message: "down" } } });
    expect(await l.prepareUpload(ORG, "png")).toEqual({ ok: false });
    expect(error).toHaveBeenCalledTimes(1);
  });

  test("remove deletes the key, and logs once without throwing when Storage fails", async () => {
    const ok = logo(vi.fn());
    await ok.logo.remove(PATH);
    expect(ok.calls.find((c) => c.table === "storage:logos" && c.method === "remove")?.args).toEqual([[PATH]]);
    expect(error).not.toHaveBeenCalled();
    const bad = logo(vi.fn(), { remove: { data: null, error: { message: "nope" } } });
    await expect(bad.logo.remove(PATH)).resolves.toBeUndefined();
    expect(error).toHaveBeenCalledTimes(1);
  });

  test("current reads the org's logo_path, null when none or no row", async () => {
    expect(await logo(vi.fn(), {}, { org_settings: { data: [{ logo_path: PATH }], error: null } }).logo.current(ORG)).toBe(PATH);
    expect(await logo(vi.fn(), {}, { org_settings: { data: [{ logo_path: null }], error: null } }).logo.current(ORG)).toBeNull();
    expect(await logo(vi.fn(), {}, { org_settings: { data: [], error: null } }).logo.current(ORG)).toBeNull();
  });
});
