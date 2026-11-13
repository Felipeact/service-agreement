import { beforeEach, describe, expect, test, vi } from "vitest";
import type { CurrentMember, MemberRole } from "@/application/ports";

const currentMember = vi.fn<() => Promise<CurrentMember>>();
const prepareUpload = vi.fn();
vi.mock("@/composition", () => ({ getContainer: async () => ({ currentMember, logo: { prepareUpload } }) }));

const { prepareLogoUpload } = await import("./logo-upload");

const ORG = "11111111-1111-4111-8111-111111111111";
const member = (role: MemberRole): CurrentMember => ({ status: "member", userId: "u1", email: "u@example.com", orgId: ORG, orgName: "Org", role });

beforeEach(() => {
  vi.clearAllMocks();
  currentMember.mockResolvedValue(member("owner"));
  prepareUpload.mockImplementation(async (orgId: string, ext: string) => ({ ok: true, path: `${orgId}/id.${ext}`, signedUrl: `https://s/sign/${ext}` }));
});

describe("prepareLogoUpload", () => {
  test.each<[string, { type: string; size: number }]>([
    ["svg", { type: "image/svg+xml", size: 100 }],
    ["gif", { type: "image/gif", size: 100 }],
    ["an empty file", { type: "image/png", size: 0 }],
    ["a file over 1 MB", { type: "image/jpeg", size: 1048577 }],
  ])("C3310: %s gets the rule's error and no upload URL", async (_name, file) => {
    const answer = await prepareLogoUpload(file);
    expect(answer).toEqual({ ok: false, error: "Use a PNG or JPEG under 1 MB" });
    expect(prepareUpload).not.toHaveBeenCalled();
  });

  test.each<[string, CurrentMember]>([
    ["an estimator", member("estimator")],
    ["a viewer", member("viewer")],
    ["a signed-in user with no membership", { status: "no_membership", userId: "u1", email: "u@example.com" } as CurrentMember],
    ["a signed-out caller", { status: "signed_out" }],
  ])("C3310: %s gets an error and no upload URL", async (_name, who) => {
    currentMember.mockResolvedValue(who);
    const answer = await prepareLogoUpload({ type: "image/png", size: 100 });
    expect(answer.ok).toBe(false);
    expect(JSON.stringify(answer)).not.toContain("signedUrl");
    expect(prepareUpload).not.toHaveBeenCalled();
  });

  test.each<MemberRole>(["owner", "admin"])("C3311: a %s gets the key for their own org and the URL Storage issued, for png and for jpeg", async (role) => {
    currentMember.mockResolvedValue(member(role));
    expect(await prepareLogoUpload({ type: "image/png", size: 100 })).toEqual({ ok: true, path: `${ORG}/id.png`, signedUrl: "https://s/sign/png", contentType: "image/png" });
    expect(await prepareLogoUpload({ type: "image/jpeg", size: 1048576 })).toEqual({ ok: true, path: `${ORG}/id.jpg`, signedUrl: "https://s/sign/jpg", contentType: "image/jpeg" });
    expect(prepareUpload.mock.calls).toEqual([[ORG, "png"], [ORG, "jpg"]]);
  });

  test("a signing failure is an error with no URL", async () => {
    prepareUpload.mockResolvedValue({ ok: false });
    expect(await prepareLogoUpload({ type: "image/png", size: 100 })).toEqual({ ok: false, error: "Logo upload failed, try again" });
  });
});
