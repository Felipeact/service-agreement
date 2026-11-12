import { describe, expect, test, vi } from "vitest";
import { supabaseMemberWorkspace, supabaseWorkspaceStatus } from "./workspace-state";

function client(reply: { data: unknown; error: { code: string; message: string } | null }) {
  const rpc = vi.fn(async () => reply);
  return { rpc, typed: { rpc } as never };
}

describe("the workspace state adapters", () => {
  test("C4221: the status read calls checkout_workspace_status once with p_session_id and nothing else", async () => {
    const { rpc, typed } = client({ data: "pending", error: null });
    await supabaseWorkspaceStatus(typed).forSession("cs_test_1");
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("checkout_workspace_status", { p_session_id: "cs_test_1" });
  });

  test.each(["pending", "ready", "refused"])("C4221: the status reply %s is passed on", async (reply) => {
    const { typed } = client({ data: reply, error: null });
    expect(await supabaseWorkspaceStatus(typed).forSession("cs_test_1")).toBe(reply);
  });

  test("C4221: the member read calls my_workspace_state once with no arguments", async () => {
    const { rpc, typed } = client({ data: "none", error: null });
    await supabaseMemberWorkspace(typed).mine();
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("my_workspace_state");
  });

  test.each(["none", "pending", "refused"])("C4221: the member reply %s is passed on", async (reply) => {
    const { typed } = client({ data: reply, error: null });
    expect(await supabaseMemberWorkspace(typed).mine()).toBe(reply);
  });

  test.each([["none"], [null], [7], ["readyy"]])("C4221: an unknown status reply %j is thrown", async (reply) => {
    const { typed } = client({ data: reply, error: null });
    await expect(supabaseWorkspaceStatus(typed).forSession("cs_test_1")).rejects.toThrow();
  });

  test.each([["ready"], [null], ["refusedd"]])("C4221: an unknown member reply %j is thrown", async (reply) => {
    const { typed } = client({ data: reply, error: null });
    await expect(supabaseMemberWorkspace(typed).mine()).rejects.toThrow();
  });

  test("C4221: a database error is thrown with its code and not the session id", async () => {
    const { typed } = client({ data: null, error: { code: "57014", message: "cs_test_secret" } });
    const failure = await supabaseWorkspaceStatus(typed).forSession("cs_test_secret").catch((error: Error) => error);
    expect((failure as Error).message).toContain("57014");
    expect((failure as Error).message).not.toContain("cs_test_secret");
    const member = await supabaseMemberWorkspace(typed).mine().catch((error: Error) => error);
    expect((member as Error).message).toContain("57014");
  });
});
