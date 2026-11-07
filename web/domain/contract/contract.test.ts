import { describe, expect, test } from "vitest";
import {
  CONTRACT_STATUSES,
  applyContractCommand,
  type ContractCommand,
  type ContractStatus,
} from "./index";

const COMMANDS: ContractCommand["type"][] = ["client_sign", "countersign", "decline", "void"];

const allowed: Array<[ContractStatus, ContractCommand["type"], ContractStatus]> = [
  ["pending_signature", "client_sign", "client_signed"],
  ["client_signed", "countersign", "completed"],
  ["pending_signature", "decline", "declined"],
  ["client_signed", "decline", "declined"],
  ["pending_signature", "void", "voided"],
  ["client_signed", "void", "voided"],
];

function okResult(status: ContractStatus, type: ContractCommand["type"]) {
  const result = applyContractCommand(status, { type });
  if (!result.ok) throw new Error(`expected ok, got ${result.error.code}`);
  return result;
}

describe("contract state machine", () => {
  test("C13: client_sign on pending_signature moves to client_signed", () => {
    const result = okResult("pending_signature", "client_sign");
    expect(result.status).toBe("client_signed");
    expect(result.event.type).toBe("contract.client_signed");
  });

  test("C14: countersign on client_signed moves to completed", () => {
    const result = okResult("client_signed", "countersign");
    expect(result.status).toBe("completed");
    expect(result.event.type).toBe("contract.completed");
  });

  test.each(["pending_signature", "client_signed"] as const)("C15: decline on %s moves to declined", (status) => {
    const result = okResult(status, "decline");
    expect(result.status).toBe("declined");
    expect(result.event.type).toBe("contract.declined");
  });

  test.each(["pending_signature", "client_signed"] as const)("C16: void on %s moves to voided", (status) => {
    const result = okResult(status, "void");
    expect(result.status).toBe("voided");
    expect(result.event.type).toBe("contract.voided");
  });

  const refused = CONTRACT_STATUSES.flatMap((status) =>
    COMMANDS.filter((type) => !allowed.some(([from, command]) => from === status && command === type)).map(
      (type) => [status, type] as const,
    ),
  );

  test("C17: the refused table has 14 status-command pairs, countersign on pending_signature among them", () => {
    expect(CONTRACT_STATUSES).toHaveLength(5);
    expect(refused).toHaveLength(14);
    expect(refused).toContainEqual(["pending_signature", "countersign"]);
  });

  test.each(refused)("C17: %s with %s is invalid_transition", (status, type) => {
    const result = applyContractCommand(status, { type });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("invalid_transition");
    expect(result.error.from).toBe(status);
    expect(result.error.command).toBe(type);
  });

  test.each(allowed)("C18: %s with %s emits a contract event from %s to %s", (from, type, to) => {
    const result = okResult(from, type);
    expect(result.status).toBe(to);
    expect(result.event.entityType).toBe("contract");
    expect(result.event.from).toBe(from);
    expect(result.event.to).toBe(to);
  });
});

describe("signature-webhook door 3", () => {
  // The moves signature_webhook makes in SQL (C1766): who may go where. The same set the pure machine allows.
  const WEBHOOK_MOVES: Array<[ContractStatus, ContractStatus]> = [
    ["pending_signature", "client_signed"],
    ["client_signed", "completed"],
    ["pending_signature", "declined"],
    ["client_signed", "declined"],
  ];

  test("C1767: client_sign is allowed only from pending_signature, countersign only from client_signed, decline from those two", () => {
    const reached: Array<[ContractStatus, ContractStatus]> = [];
    for (const from of CONTRACT_STATUSES) {
      for (const type of ["client_sign", "countersign", "decline"] as const) {
        const result = applyContractCommand(from, { type });
        if (result.ok) reached.push([from, result.status]);
      }
    }
    const key = (pairs: Array<[ContractStatus, ContractStatus]>) => pairs.map(([from, to]) => `${from}>${to}`).sort();
    expect(key(reached)).toEqual(key(WEBHOOK_MOVES));
    expect(applyContractCommand("completed", { type: "client_sign" }).ok).toBe(false);
    expect(applyContractCommand("declined", { type: "decline" }).ok).toBe(false);
    expect(applyContractCommand("voided", { type: "countersign" }).ok).toBe(false);
  });
});
