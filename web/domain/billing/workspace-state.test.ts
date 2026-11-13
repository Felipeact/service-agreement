import { describe, expect, test } from "vitest";
import { WORKSPACE_MAX_POLLS, WORKSPACE_POLL_MS, panelFor, type WorkspaceAnswer } from "./workspace-state";

const pending = (n: number): WorkspaceAnswer[] => Array.from({ length: n }, () => "pending");

describe("the workspace panel", () => {
  test("C4209: the poll rhythm is 3000 ms, 20 asks", () => {
    expect(WORKSPACE_POLL_MS).toBe(3000);
    expect(WORKSPACE_MAX_POLLS).toBe(20);
  });

  test.each<[string, WorkspaceAnswer[], string]>([
    ["no answer yet", [], "waiting"],
    ["one pending", pending(1), "waiting"],
    ["19 pending", pending(19), "waiting"],
    ["20 pending", pending(20), "slow"],
    ["ready", ["ready"], "ready"],
    ["ready after pendings", [...pending(5), "ready"], "ready"],
    ["refused", ["refused"], "refused"],
    ["refused after pendings", [...pending(3), "refused"], "refused"],
    ["unavailable", ["unavailable"], "slow"],
    ["unavailable after pendings", [...pending(2), "unavailable"], "slow"],
  ])("C4209: %s -> %s", (_name, answers, panel) => {
    expect(panelFor(answers)).toBe(panel);
  });
});
