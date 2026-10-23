import { describe, expect, test } from "vitest";
import {
  AGREEMENT_STATUSES,
  applyAgreementCommand,
  type AgreementCommand,
  type AgreementStatus,
} from "./index";

const sample: Record<AgreementCommand["type"], AgreementCommand> = {
  send: { type: "send" },
  accept: { type: "accept" },
  refuse: { type: "refuse", reason: "Over budget" },
  request_changes: { type: "request_changes", reason: "Add the boiler" },
  revise: { type: "revise", versionNo: 1 },
  expire: { type: "expire" },
  withdraw: { type: "withdraw" },
};

const allowed: Array<[AgreementStatus, AgreementCommand["type"], AgreementStatus]> = [
  ["draft", "send", "sent"],
  ["sent", "accept", "accepted"],
  ["sent", "refuse", "refused"],
  ["sent", "request_changes", "changes_requested"],
  ["changes_requested", "revise", "draft"],
  ["sent", "expire", "expired"],
  ["draft", "withdraw", "withdrawn"],
  ["sent", "withdraw", "withdrawn"],
];

function okResult(status: AgreementStatus, command: AgreementCommand) {
  const result = applyAgreementCommand(status, command);
  if (!result.ok) throw new Error(`expected ok, got ${result.error.code}`);
  return result;
}

describe("agreement state machine", () => {
  test("C1: send on draft moves to sent", () => {
    const result = applyAgreementCommand("draft", { type: "send" });
    expect(result.ok).toBe(true);
    expect(result.ok && result.status).toBe("sent");
    expect(result.ok && result.event.type).toBe("agreement.sent");
  });

  test("C2: accept on sent moves to accepted", () => {
    const result = okResult("sent", { type: "accept" });
    expect(result.status).toBe("accepted");
    expect(result.event.type).toBe("agreement.accepted");
  });

  test("C3: refuse on sent moves to refused with the trimmed reason", () => {
    const result = okResult("sent", { type: "refuse", reason: "  Over budget  " });
    expect(result.status).toBe("refused");
    expect(result.event.type).toBe("agreement.refused");
    expect(result.event.data.reason).toBe("Over budget");
  });

  test.each(["", "   "])("C4: refuse with reason %j is reason_required", (reason) => {
    const result = applyAgreementCommand("sent", { type: "refuse", reason });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.code).toBe("reason_required");
    expect(!result.ok && result.error.from).toBe("sent");
  });

  test.each(["refuse", "request_changes"] as const)("C5: %s reason bound is 2000 characters after trimming", (type) => {
    const atLimit = applyAgreementCommand("sent", { type, reason: ` ${"a".repeat(2000)} ` });
    expect(atLimit.ok).toBe(true);
    const overLimit = applyAgreementCommand("sent", { type, reason: "a".repeat(2001) });
    expect(overLimit.ok).toBe(false);
    expect(!overLimit.ok && overLimit.error.code).toBe("reason_too_long");
  });

  test("C6: request_changes on sent moves to changes_requested with the trimmed note", () => {
    const result = okResult("sent", { type: "request_changes", reason: " Add the boiler " });
    expect(result.status).toBe("changes_requested");
    expect(result.event.type).toBe("agreement.changes_requested");
    expect(result.event.data.reason).toBe("Add the boiler");
  });

  test.each(["", "   "])("C7: request_changes with note %j is reason_required", (reason) => {
    const result = applyAgreementCommand("sent", { type: "request_changes", reason });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.code).toBe("reason_required");
  });

  test.each([
    [1, 2],
    [3, 4],
  ])("C8: revise on changes_requested at version %i returns draft at version %i", (versionNo, next) => {
    const result = okResult("changes_requested", { type: "revise", versionNo });
    expect(result.status).toBe("draft");
    expect(result.event.type).toBe("agreement.revised");
    expect(result.event.data.versionNo).toBe(next);
  });

  test("C9: expire on sent moves to expired", () => {
    const result = okResult("sent", { type: "expire" });
    expect(result.status).toBe("expired");
    expect(result.event.type).toBe("agreement.expired");
  });

  test.each(["draft", "sent"] as const)("C10: withdraw on %s moves to withdrawn", (status) => {
    const result = okResult(status, { type: "withdraw" });
    expect(result.status).toBe("withdrawn");
    expect(result.event.type).toBe("agreement.withdrawn");
  });

  const refused = AGREEMENT_STATUSES.flatMap((status) =>
    (Object.keys(sample) as AgreementCommand["type"][])
      .filter((type) => !allowed.some(([from, command]) => from === status && command === type))
      .map((type) => [status, type] as const),
  );

  test("C11: the refused table has 41 status-command pairs", () => {
    expect(AGREEMENT_STATUSES).toHaveLength(7);
    expect(refused).toHaveLength(41);
  });

  test.each(refused)("C11: %s with %s is invalid_transition", (status, type) => {
    const result = applyAgreementCommand(status, sample[type]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("invalid_transition");
    expect(result.error.from).toBe(status);
    expect(result.error.command).toBe(type);
  });

  test.each(allowed)("C12: %s with %s emits an agreement event from %s to %s", (from, type, to) => {
    const result = okResult(from, sample[type]);
    expect(result.status).toBe(to);
    expect(result.event.entityType).toBe("agreement");
    expect(result.event.from).toBe(from);
    expect(result.event.to).toBe(to);
  });
});
