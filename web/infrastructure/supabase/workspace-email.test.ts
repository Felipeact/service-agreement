import { describe, expect, test, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseWorkspaceEmailCheck } from "./workspace-email";

const clientAnswering = (reply: { data: unknown; error: { code: string; message: string } | null }) => {
  const rpc = vi.fn(async () => reply);
  return { rpc, client: { rpc } as unknown as SupabaseClient<never> };
};

describe("the workspace email check adapter", () => {
  test.each([true, false])("C4315: %s from email_has_workspace is returned, asked once with the email as p_email", async (answer) => {
    const { rpc, client } = clientAnswering({ data: answer, error: null });
    expect(await supabaseWorkspaceEmailCheck(client as never).inUse("owner@shop.ca")).toBe(answer);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("email_has_workspace", { p_email: "owner@shop.ca" });
  });

  test("C4315: a database error throws naming only the function and the code, never the email or the message", async () => {
    const { client } = clientAnswering({ data: null, error: { code: "57014", message: "row for owner@shop.ca timed out" } });
    const error = await supabaseWorkspaceEmailCheck(client as never).inUse("owner@shop.ca").catch((cause: Error) => cause);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe("email_has_workspace failed: 57014");
  });

  test.each([null, "true", 1, undefined])("C4315: a non-boolean answer (%s) throws", async (data) => {
    const { client } = clientAnswering({ data, error: null });
    await expect(supabaseWorkspaceEmailCheck(client as never).inUse("owner@shop.ca")).rejects.toThrow("email_has_workspace answered a value it should not");
  });
});
