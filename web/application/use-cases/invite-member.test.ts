import { beforeEach, describe, expect, test, vi } from "vitest";
import type { InvitationLinkSender, InviteResult, MemberAdmin } from "@/application/ports";
import { makeInviteMember, type InviteState } from "./invite-member";

const invite = vi.fn<MemberAdmin["invite"]>();
const send = vi.fn<InvitationLinkSender["send"]>();
const inviteMember = makeInviteMember({ invite }, { send });

beforeEach(() => {
  vi.clearAllMocks();
  invite.mockResolvedValue({ ok: true, id: "inv-1" });
  send.mockResolvedValue({ ok: true });
});

type Row = { name: InviteState; input: { email: string; role: string }; stored?: InviteResult; sent?: Awaited<ReturnType<InvitationLinkSender["send"]>> };

const CASES: Row[] = [
  { name: "sent", input: { email: " Pat@Example.com ", role: "estimator" } },
  { name: "invalid", input: { email: "not-an-address", role: "viewer" } },
  { name: "invalid", input: { email: "pat@example.com", role: "root" } },
  { name: "already_member", input: { email: "pat@example.com", role: "viewer" }, stored: { ok: false, code: "already_member" } },
  { name: "owner_only", input: { email: "pat@example.com", role: "owner" }, stored: { ok: false, code: "owner_only" } },
  { name: "forbidden", input: { email: "pat@example.com", role: "viewer" }, stored: { ok: false, code: "forbidden" } },
  { name: "unavailable", input: { email: "pat@example.com", role: "viewer" }, stored: { ok: false, code: "unavailable" } },
  { name: "rate_limited", input: { email: "pat@example.com", role: "viewer" }, sent: { ok: false, code: "rate_limited" } },
  { name: "saved_not_sent", input: { email: "pat@example.com", role: "viewer" }, sent: { ok: false, code: "unavailable" } },
];

describe("inviteMember", () => {
  test.each(CASES)("C1514: $name for $input.email as $input.role", async ({ name, input, stored, sent }) => {
    if (stored) invite.mockResolvedValue(stored);
    if (sent) send.mockResolvedValue(sent);

    const outcome = await inviteMember(input);

    expect(outcome.status).toBe(name);
    const touchesStore = name !== "invalid";
    expect(invite).toHaveBeenCalledTimes(touchesStore ? 1 : 0);
    const sendsLink = name === "sent" || name === "rate_limited" || name === "saved_not_sent";
    expect(send).toHaveBeenCalledTimes(sendsLink ? 1 : 0);
  });

  test("C1514: an invalid address or role calls neither port and keeps what was typed, trimmed", async () => {
    expect(await inviteMember({ email: "  nope ", role: "viewer" })).toEqual({ status: "invalid", email: "nope" });
    expect(invite).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  test("C1514: the admin port and the sender get the normalised address, and the outcome carries it", async () => {
    expect(await inviteMember({ email: " Pat@Example.com ", role: "estimator" })).toEqual({ status: "sent", email: "pat@example.com" });
    expect(invite).toHaveBeenCalledWith("pat@example.com", "estimator");
    expect(send).toHaveBeenCalledWith("pat@example.com");
  });

  test("C1514: a refused store never reaches the sender", async () => {
    invite.mockResolvedValue({ ok: false, code: "already_member" });
    const outcome = await inviteMember({ email: "pat@example.com", role: "viewer" });
    expect(outcome).toEqual({ status: "already_member", email: "pat@example.com" });
    expect(send).not.toHaveBeenCalled();
  });
});
