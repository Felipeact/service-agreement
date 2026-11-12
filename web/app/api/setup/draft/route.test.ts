import { readFileSync } from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { CatalogDrafter, CurrentMember, DraftInput, DraftResult, ImportParser } from "@/application/ports";
import { makeDraftCatalog } from "@/application/use-cases/draft-catalog";

const ORG = "22222222-2222-4222-8222-222222222222";
const PDF = "application/pdf";
const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const GOOD: DraftResult = {
  ok: true,
  types: [
    { name: "Pool pump", defaultVisitMonths: [4, 10], synonyms: ["pool pumps"], tasks: [{ description: "Check seals" }] },
    { name: "pool PUMP", defaultVisitMonths: [1], synonyms: [], tasks: [{ description: "Duplicate" }] },
  ],
};

let member: CurrentMember;
let allowed: boolean;
let drafterResult: DraftResult;
let drafterCalls: DraftInput[];
let parserCalls: number;
let parsed: Awaited<ReturnType<ImportParser["parse"]>>;

vi.mock("@/composition", () => ({
  getContainer: async () => {
    const drafter: CatalogDrafter = { draft: async (input) => (drafterCalls.push(input), drafterResult) };
    const parser: ImportParser = { parse: async () => (parserCalls++, parsed) };
    return { currentMember: async () => member, catalogDraftAllowed: async () => allowed, draftCatalog: makeDraftCatalog({ parser, drafter }) };
  },
}));

import { maxDuration, POST } from "./route";

const asMember = (role: "owner" | "admin" | "estimator" | "viewer"): CurrentMember => ({ status: "member", userId: "u1", email: "o@x.test", orgId: ORG, orgName: "Org", role });

function post(fields: { description?: string; file?: { bytes: number | Uint8Array; type: string; name?: string } | null }, headers: Record<string, string> = {}) {
  const form = new FormData();
  if (fields.description !== undefined) form.set("description", fields.description);
  if (fields.file) {
    const bytes = typeof fields.file.bytes === "number" ? new Uint8Array(fields.file.bytes) : fields.file.bytes;
    form.set("file", new File([bytes as BlobPart], fields.file.name ?? "proposal", { type: fields.file.type }));
  }
  return POST(new NextRequest("http://localhost/api/setup/draft", { method: "POST", body: form, headers }));
}

beforeEach(() => {
  member = asMember("owner");
  allowed = true;
  drafterResult = GOOD;
  drafterCalls = [];
  parserCalls = 0;
  parsed = { ok: true, parsed: { format: "pdf", bytes: new Uint8Array([37, 80, 68, 70, 45]) } };
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("POST /api/setup/draft", () => {
  test("C3405: with no file, a missing, empty, blank or 1,001-character description is 400 invalid_input and Claude is not called; 1 and 1,000 are accepted", async () => {
    for (const description of [undefined, "", "   ", "x".repeat(1001)]) {
      const response = await post({ description });
      expect(response.status, String(description?.length)).toBe(400);
      expect((await response.json()).error).toBe("invalid_input");
    }
    expect(drafterCalls).toHaveLength(0);
    for (const length of [1, 1000]) expect((await post({ description: "x".repeat(length) })).status).toBe(200);
    expect(drafterCalls).toHaveLength(2);
  });

  test("C3405: a body that is not multipart, a file field holding text and a description field holding a file are 400 invalid_input", async () => {
    const raw = await POST(new NextRequest("http://localhost/api/setup/draft", { method: "POST", body: "not a form", headers: { "content-type": "multipart/form-data; boundary=x" } }));
    expect(raw.status).toBe(400);

    const textFile = new FormData();
    textFile.set("file", "just text");
    const a = await POST(new NextRequest("http://localhost/api/setup/draft", { method: "POST", body: textFile }));
    expect(a.status).toBe(400);

    const fileDescription = new FormData();
    fileDescription.set("description", new File(["x"], "d.txt"));
    const b = await POST(new NextRequest("http://localhost/api/setup/draft", { method: "POST", body: fileDescription }));
    expect(b.status).toBe(400);
    expect((await b.json()).error).toBe("invalid_input");

    const validWithTextFile = new FormData();
    validWithTextFile.set("description", "We service pools");
    validWithTextFile.set("file", "just text");
    expect((await POST(new NextRequest("http://localhost/api/setup/draft", { method: "POST", body: validWithTextFile }))).status).toBe(400);
    expect(drafterCalls).toHaveLength(0);
  });

  test("C3406: an owner and an admin get 200 with the cleaned draft", async () => {
    for (const role of ["owner", "admin"] as const) {
      member = asMember(role);
      const response = await post({ description: "We service heated pools" });
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ types: [GOOD.ok ? GOOD.types[0] : null] });
    }
    expect(drafterCalls[0]).toEqual({ description: "We service heated pools" });
  });

  test("C3407: an unavailable drafter is 503 unavailable and a draft with no valid type is 422 empty_draft", async () => {
    drafterResult = { ok: false, code: "unavailable" };
    const down = await post({ description: "pools" });
    expect(down.status).toBe(503);
    expect((await down.json()).error).toBe("unavailable");

    drafterResult = { ok: true, types: [{ name: "", defaultVisitMonths: [], synonyms: [], tasks: [] }] };
    const empty = await post({ description: "pools" });
    expect(empty.status).toBe(422);
    expect((await empty.json()).error).toBe("empty_draft");

    drafterResult = { ok: false, code: "empty" };
    expect((await post({ description: "pools" })).status).toBe(422);
  });

  test("C3408: a PDF of exactly 5,242,880 bytes goes to the drafter as a pdf document and is 200", async () => {
    const response = await post({ file: { bytes: 5_242_880, type: PDF } });
    expect(response.status).toBe(200);
    expect(drafterCalls).toHaveLength(1);
    expect(drafterCalls[0].document?.kind).toBe("pdf");
  });

  test("C3411: 5,242,881 bytes is 413 file_too_large before the parser or Claude, and so is a declared body over 6 MB", async () => {
    const response = await post({ file: { bytes: 5_242_881, type: PDF } });
    expect(response.status).toBe(413);
    expect((await response.json()).error).toBe("file_too_large");
    expect(parserCalls).toBe(0);
    expect(drafterCalls).toHaveLength(0);

    const declared = await post({ description: "pools" }, { "content-length": "7000000" });
    expect(declared.status).toBe(413);
    expect(drafterCalls).toHaveLength(0);
  });

  test("C3412: a spreadsheet, a CSV, an image and plain text are 415 unsupported_type and neither the parser nor Claude is called", async () => {
    for (const type of [XLSX, "text/csv", "image/png", "text/plain"]) {
      const response = await post({ file: { bytes: 10, type } });
      expect(response.status, type).toBe(415);
      expect((await response.json()).error).toBe("unsupported_type");
    }
    expect(parserCalls).toBe(0);
    expect(drafterCalls).toHaveLength(0);
  });

  test("C3414: a proposal too large for one answer is 422 unreadable with a message to upload fewer pages or describe the trade", async () => {
    drafterResult = { ok: false, code: "too_large" };
    const response = await post({ file: { bytes: 100, type: PDF } });
    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.error).toBe("unreadable");
    expect(body.message).toMatch(/fewer pages/i);
    expect(body.message).toMatch(/describe the trade/i);
  });

  test("C3413: a file the parser refuses is 422 unreadable at the route as well", async () => {
    parsed = { ok: false, reason: "corrupt" };
    const response = await post({ file: { bytes: 100, type: DOCX } });
    expect(response.status).toBe(422);
    expect((await response.json()).error).toBe("unreadable");
    expect(drafterCalls).toHaveLength(0);
  });

  test("C3434: no session is 401, an estimator, a viewer and a user with no membership are 403, a finished or non-Other org is 409, and Claude is called in none", async () => {
    member = { status: "signed_out" };
    const signedOut = await post({ description: "pools" });
    expect(signedOut.status).toBe(401);
    expect((await signedOut.json()).error).toBe("signed_out");

    for (const who of [asMember("estimator"), asMember("viewer"), { status: "no_membership", email: "x@y.test" } as CurrentMember]) {
      member = who;
      const response = await post({ description: "pools" });
      expect(response.status).toBe(403);
      expect((await response.json()).error).toBe("forbidden");
    }

    member = asMember("owner");
    allowed = false;
    const notAvailable = await post({ description: "pools" });
    expect(notAvailable.status).toBe(409);
    expect((await notAvailable.json()).error).toBe("not_available");
    expect(drafterCalls).toHaveLength(0);
    expect(parserCalls).toBe(0);
  });

  test("C3437: the route may run 60 seconds and proxy leaves /api/setup/draft behind the sign-in", () => {
    expect(maxDuration).toBeGreaterThanOrEqual(60);
    const session = readFileSync(path.join(__dirname, "../../../../infrastructure/supabase/session.ts"), "utf8");
    const lists = [...session.matchAll(/const PUBLIC_(?:PATHS|PREFIXES) = \[([^\]]*)\]/g)].map((m) => m[1]).join(",");
    expect(lists).not.toMatch(/api\/setup|"\/api\/"|"\/api"/);
  });
});
