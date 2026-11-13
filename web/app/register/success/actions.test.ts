import { beforeEach, describe, expect, test, vi } from "vitest";

const forSession = vi.fn<(id: string) => Promise<"pending" | "ready" | "refused">>();
vi.mock("@/composition", () => ({ getWorkspaceStatusContainer: async () => ({ workspaceStatus: { forSession } }) }));

const { checkWorkspaceAction } = await import("./actions");

beforeEach(() => vi.clearAllMocks());

describe("the workspace status action", () => {
  test.each(["pending", "ready", "refused"] as const)("C4208: the port's answer %s is returned, asked once with the id", async (answer) => {
    forSession.mockResolvedValue(answer);
    expect(await checkWorkspaceAction("cs_test_1")).toBe(answer);
    expect(forSession).toHaveBeenCalledTimes(1);
    expect(forSession).toHaveBeenCalledWith("cs_test_1");
  });

  test("C4208: a port that throws is unavailable, not an error", async () => {
    forSession.mockRejectedValue(new Error("checkout_workspace_status failed: 57014"));
    expect(await checkWorkspaceAction("cs_test_1")).toBe("unavailable");
  });

  test("C4208: an id that is not a string is unavailable and reaches no port", async () => {
    expect(await checkWorkspaceAction(undefined as unknown as string)).toBe("unavailable");
    expect(await checkWorkspaceAction({ id: 1 } as unknown as string)).toBe("unavailable");
    expect(forSession).not.toHaveBeenCalled();
  });
});
