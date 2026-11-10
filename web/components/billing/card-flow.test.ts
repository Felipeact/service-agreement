import { describe, expect, test, vi } from "vitest";
import { beginCardUpdate, completeCardUpdate } from "./card-flow";

describe("the card update flow", () => {
  test("C3117: begin asks the server for a SetupIntent and hands back its client secret", async () => {
    const start = vi.fn(async () => ({ status: "ready" as const, clientSecret: "seti_secret" }));
    expect(await beginCardUpdate(start)).toEqual({ status: "ready", clientSecret: "seti_secret" });
    expect(start).toHaveBeenCalledTimes(1);
  });

  test("C3139: begin answering forbidden is the permission state and unavailable is the failure state", async () => {
    expect(await beginCardUpdate(async () => ({ status: "forbidden" }))).toEqual({ status: "forbidden" });
    expect(await beginCardUpdate(async () => ({ status: "unavailable" }))).toEqual({ status: "failed" });
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

  test("C3117: finish answering failed is the card failure", async () => {
    const confirm = async () => ({ ok: true as const, setupIntentId: "seti_1AbC" });
    expect(await completeCardUpdate({ confirm, finish: async () => ({ status: "failed" }) })).toEqual({ status: "failed" });
  });

  test("C3139: finish answering forbidden is the permission state", async () => {
    const confirm = async () => ({ ok: true as const, setupIntentId: "seti_1AbC" });
    expect(await completeCardUpdate({ confirm, finish: async () => ({ status: "forbidden" }) })).toEqual({ status: "forbidden" });
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
