import { describe, expect, test } from "vitest";
import type { AgreementDetail, AgreementTemplateSummary } from "@/application/ports";
import { SYSTEM_AGREEMENT_BODY } from "@/domain/agreement";
import { templateChoicesOf } from "./template-choices";

const summary = (versionId: string, name: string, system = false) => ({ id: `t-${versionId}`, versionId, versionNo: 1, updatedAt: new Date(), system, body: { ...SYSTEM_AGREEMENT_BODY, name } }) as AgreementTemplateSummary;
const SYSTEM = summary("v-sys", "Standard agreement", true);
const OWN = summary("v-own", "Quarterly HVAC");
const agreement = (over: Partial<AgreementDetail>) => ({ template: { ...SYSTEM_AGREEMENT_BODY, name: "Quarterly HVAC" }, ...over }) as AgreementDetail;
const list = (templates: AgreementTemplateSummary[]) => async () => ({ ok: true as const, templates });

describe("templateChoicesOf", () => {
  test("C7110: it offers every template the member can see and selects the pinned one", async () => {
    const out = await templateChoicesOf(list([OWN, SYSTEM]), agreement({ templateVersionId: "v-own" }));
    expect(out).toEqual({ choices: [{ versionId: "v-own", name: "Quarterly HVAC" }, { versionId: "v-sys", name: "Standard agreement (built in)" }], selected: "v-own" });
  });

  test("C7110: a version nobody pinned selects the system template", async () => {
    const out = await templateChoicesOf(list([OWN, SYSTEM]), agreement({ templateVersionId: null }));
    expect(out?.selected).toBe("v-sys");
  });

  test("C7110: a pinned version that is no longer the latest stays in the list under its own name", async () => {
    const out = await templateChoicesOf(list([OWN, SYSTEM]), agreement({ templateVersionId: "v-old" }));
    expect(out?.selected).toBe("v-old");
    expect(out?.choices[0]).toEqual({ versionId: "v-old", name: "Quarterly HVAC (earlier version)" });
    expect(out?.choices).toHaveLength(3);
  });

  test.each([
    ["a failed read", async () => ({ ok: false as const, code: "unavailable" as const })],
    ["a thrown read", async () => {
      throw new Error("down");
    }],
  ])("C7110: %s offers no choice", async (_label, read) => {
    expect(await templateChoicesOf(read as never, agreement({ templateVersionId: "v-own" }))).toBeUndefined();
  });

  test("C7110: the built-in template is labelled so it is not mistaken for an org copy with the same name", async () => {
    const copy = summary("v-copy", "Standard agreement");
    const out = await templateChoicesOf(list([copy, SYSTEM]), agreement({ templateVersionId: "v-copy" }));
    expect(out?.choices.map((choice) => choice.name)).toEqual(["Standard agreement", "Standard agreement (built in)"]);
  });
});
