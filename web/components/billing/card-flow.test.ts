import { describe, expect, test, vi } from "vitest";
import { beginCardUpdate, completeCardUpdate } from "./card-flow";

describe("the card update flow", () => {
  test("C3117: begin asks the server for a SetupIntent and hands back its client secret", async () => {
    const start = vi.fn(async () => ({ status: "ready" as const, clientSecret: "seti_secret" }));
    expect(await beginCardUpdate(start)).toEqual({ status: "ready", clientSecret: "seti_secret" });
    expect(start).toHaveBeenCalledTimes(1);
  });

  test.each([["forbidden"], ["unavailable"]] as const)("C3117: begin answering %s is the failure state", async (status) => {
    expect(await beginCardUpdate(async () => ({ status }))).toEqual({ status: "failed" });
  });

  test("C3117: begin that throws is the failure state", async () => {
    expect(
      await beginCardUpdate(async () => {
        throw new Error("network");
      }),
    ).toEqual({ status: "failed" });
  });

  test("C3117: complete confirms with Stripe, then calls finish with only the SetupIntent id", async () => {
    const confirm = vi.fn(async () => ({ ok: true as const, setupIntentId: "seti_1AbC" }));
    const finish = vi.fn(async () => ({ status: "saved" as const }));
    expect(await completeCardUpdate({ confirm, finish })).toEqual({ status: "saved" });
    expect(finish).toHaveBeenCalledTimes(1);
    expect(finish.mock.calls[0]).toEqual(["seti_1AbC"]);
  });

  test("C3117: a Stripe error from the confirm shows Stripe's message and finish is not called", async () => {
    const confirm = vi.fn(async () => ({ ok: false as const, message: "Your card was declined." }));
    const finish = vi.fn();
    expect(await completeCardUpdate({ confirm, finish })).toEqual({ status: "stripe_error", message: "Your card was declined." });
    expect(finish).not.toHaveBeenCalled();
  });

  test.each([["failed"], ["forbidden"]] as const)("C3117: finish answering %s is the card failure", async (status) => {
    const confirm = async () => ({ ok: true as const, setupIntentId: "seti_1AbC" });
    expect(await completeCardUpdate({ confirm, finish: async () => ({ status }) })).toEqual({ status: "failed" });
  });

  test("C3117: finish that throws is the card failure", async () => {
    const confirm = async () => ({ ok: true as const, setupIntentId: "seti_1AbC" });
    expect(
      await completeCardUpdate({
        confirm,
        finish: async () => {
          throw new Error("network");
        },
      }),
    ).toEqual({ status: "failed" });
  });
});
