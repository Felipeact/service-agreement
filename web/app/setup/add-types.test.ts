import { beforeEach, describe, expect, test, vi } from "vitest";
import type { AddTypesResult, CurrentMember } from "@/application/ports";
import type { DraftType } from "@/domain/task-library/draft";

const ORG = "22222222-2222-4222-8222-222222222222";

let member: CurrentMember;
let stored: AddTypesResult;
let calls: { orgId: string; types: DraftType[] }[];

vi.mock("@/composition", () => ({
  getContainer: async () => ({
    currentMember: async () => member,
    addCatalogTypes: async (orgId: string, types: DraftType[]) => (calls.push({ orgId, types }), stored),
  }),
}));

import { addCatalogTypesAction } from "./add-types";

const asMember = (role: "owner" | "admin" | "estimator" | "viewer"): CurrentMember => ({ status: "member", userId: "u1", email: "o@x.test", orgId: ORG, orgName: "Org", role });
const TYPES: DraftType[] = [
  { name: "Pool pump", defaultVisitMonths: [4, 10], synonyms: ["pool pumps"], tasks: [{ description: "Check seals" }] },
  { name: "Sprinkler head", defaultVisitMonths: [5], synonyms: [], tasks: [{ description: "Test spray" }] },
];

beforeEach(() => {
  member = asMember("owner");
  stored = { ok: true, codes: ["POOL_PUMP", "SPRINKLER_HEAD"] };
  calls = [];
});

describe("addCatalogTypesAction", () => {
  test("C3419: an owner's reviewed types reach OrgSetup.addTypes once, with the org id and after normalizeDraft, and the names come back", async () => {
    const edited = [{ ...TYPES[0], name: "  Pool pump  ", synonyms: ["Pool Pumps ", "", "pump"] }, TYPES[1]];
    expect(await addCatalogTypesAction(edited)).toEqual({ ok: true, added: ["Pool pump", "Sprinkler head"] });
    expect(calls).toHaveLength(1);
    expect(calls[0].orgId).toBe(ORG);
    expect(calls[0].types).toEqual([{ ...TYPES[0], synonyms: ["pool pumps", "pump"] }, TYPES[1]]);

    member = asMember("admin");
    expect((await addCatalogTypesAction(TYPES)).ok).toBe(true);
    expect(calls).toHaveLength(2);
  });

  test("C3425: a member who is not an owner or admin never reaches the store", async () => {
    for (const who of [asMember("estimator"), asMember("viewer"), { status: "no_membership", email: "x@y.test" } as CurrentMember, { status: "signed_out" } as CurrentMember]) {
      member = who;
      expect(await addCatalogTypesAction(TYPES)).toEqual({ ok: false, code: "forbidden" });
    }
    expect(calls).toHaveLength(0);
  });

  test("C3425: the store's forbidden, duplicate, invalid and unavailable answers come back as they are", async () => {
    for (const answer of [
      { ok: false, code: "forbidden" },
      { ok: false, code: "duplicate", name: "Pool pump" },
      { ok: false, code: "invalid" },
      { ok: false, code: "unavailable" },
    ] as const) {
      stored = answer;
      expect(await addCatalogTypesAction(TYPES)).toEqual(answer);
    }
  });

  test("C3425: a draft that cleaning would change, or that is not a list, is invalid and nothing is sent", async () => {
    expect(await addCatalogTypesAction([{ ...TYPES[0], tasks: [] }, TYPES[1]])).toEqual({ ok: false, code: "invalid" });
    expect(await addCatalogTypesAction([TYPES[0], { ...TYPES[1], name: "pool PUMP" }])).toEqual({ ok: false, code: "invalid" });
    for (const input of [null, undefined, "x", {}, []]) expect(await addCatalogTypesAction(input)).toEqual({ ok: false, code: "invalid" });
    expect(calls).toHaveLength(0);
  });
});
