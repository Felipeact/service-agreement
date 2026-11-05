import { afterEach, describe, expect, test, vi } from "vitest";
import type { ExtractChunk } from "@/application/ports";
import { claudeAssetExtractor, SYSTEM_PROMPT, type ClaudeMessage } from ".";

/** An Anthropic client double: every entry point answers with the same scripted message and records the request. */
function fakeClient(answer: ClaudeMessage | Error) {
  const requests: Record<string, unknown>[] = [];
  const respond = async (params: Record<string, unknown>) => {
    requests.push(params);
    if (answer instanceof Error) throw answer;
    return answer;
  };
  const entry = { create: respond, stream: (params: Record<string, unknown>) => ({ finalMessage: () => respond(params) }) };
  return { client: { messages: entry, beta: { messages: entry } }, requests };
}

const say = (value: unknown): ClaudeMessage => ({ stop_reason: "end_turn", content: [{ type: "text", text: typeof value === "string" ? value : JSON.stringify(value) }] });
const goodRow = { asset_type_raw: "Rooftop unit", unit_no: "RTU-1", type_model: "Carrier 48", location: "Roof", confidence: "high", source_ref: "Units!4" };

const rowsChunk: ExtractChunk = {
  kind: "rows",
  table: "Units",
  header: ["Unit", "Type"],
  rows: [
    { ref: "Units!4", cells: ["RTU-1", "Carrier 48"] },
    { ref: "Units!5", cells: ["MAU-2", "Greenheck"] },
  ],
};
const textChunk: ExtractChunk = { kind: "text", text: "Unit 1: RTU on roof" };
const pdfChunk: ExtractChunk = { kind: "pdf", bytes: new Uint8Array([37, 80, 68, 70, 45, 49]) };

/** `apiKey` null means the key is not set. */
const extractorFor = (answer: ClaudeMessage | Error, apiKey: string | null = "test-key") => {
  const fake = fakeClient(answer);
  return { ...fake, extractor: claudeAssetExtractor({ apiKey: apiKey ?? undefined, client: fake.client as never }) };
};

afterEach(() => vi.restoreAllMocks());

describe("claudeAssetExtractor", () => {
  test("C502: a rows chunk sends its header, refs and cells; a text chunk its text; a pdf chunk one document block", async () => {
    const rows = extractorFor(say({ rows: [] }));
    await rows.extractor.extract(rowsChunk);
    const sent = JSON.stringify(rows.requests[0].messages);
    for (const part of ["Unit", "Type", "Units!4", "RTU-1", "Carrier 48", "Units!5", "MAU-2", "Greenheck"]) expect(sent).toContain(part);

    const text = extractorFor(say({ rows: [] }));
    await text.extractor.extract(textChunk);
    expect(JSON.stringify(text.requests[0].messages)).toContain("Unit 1: RTU on roof");

    const pdf = extractorFor(say({ rows: [] }));
    await pdf.extractor.extract(pdfChunk);
    const content = (pdf.requests[0].messages as { content: { type: string; source?: { media_type: string; data: string } }[] }[])[0].content;
    const documents = content.filter((block) => block.type === "document");
    expect(documents).toHaveLength(1);
    expect(documents[0].source?.media_type).toBe("application/pdf");
    expect([...Buffer.from(documents[0].source!.data, "base64")]).toEqual([...pdfChunk.bytes]);
  });

  test("C510: the request asks for a json_schema output of exactly the six row properties", async () => {
    const { extractor, requests } = extractorFor(say({ rows: [] }));
    await extractor.extract(rowsChunk);

    const format = (requests[0].output_config as { format: { type: string; schema: Record<string, unknown> } }).format;
    expect(format.type).toBe("json_schema");
    const schema = format.schema as { required: string[]; additionalProperties: boolean; properties: { rows: { type: string; items: Record<string, unknown> } } };
    expect(schema.required).toEqual(["rows"]);
    expect(schema.properties.rows.type).toBe("array");
    const item = schema.properties.rows.items as { properties: Record<string, unknown>; required: string[]; additionalProperties: boolean };
    const keys = ["asset_type_raw", "unit_no", "type_model", "location", "confidence", "source_ref"];
    expect(Object.keys(item.properties).sort()).toEqual([...keys].sort());
    expect([...item.required].sort()).toEqual([...keys].sort());
    expect(item.additionalProperties).toBe(false);
    for (const key of keys.filter((k) => k !== "confidence")) {
      expect(JSON.stringify(item.properties[key])).toContain('"string"');
      expect(JSON.stringify(item.properties[key])).toContain('"null"');
    }
    expect((item.properties.confidence as { enum: string[] }).enum).toEqual(["low", "medium", "high"]);
  });

  test.each<[string, unknown, unknown]>([
    [
      "all three confidences with every field set",
      { rows: ["low", "medium", "high"].map((confidence, i) => ({ ...goodRow, confidence, unit_no: `U${i}` })) },
      ["low", "medium", "high"].map((confidence, i) => ({ assetTypeRaw: "Rooftop unit", unitNo: `U${i}`, typeModel: "Carrier 48", location: "Roof", confidence, sourceRef: "Units!4" })),
    ],
    [
      "a row of nulls",
      { rows: [{ asset_type_raw: null, unit_no: null, type_model: null, location: null, confidence: "low", source_ref: null }] },
      [{ assetTypeRaw: null, unitNo: null, typeModel: null, location: null, confidence: "low", sourceRef: null }],
    ],
    ["no rows", { rows: [] }, []],
  ])("C511: %s", async (_name, answer, rows) => {
    const { extractor } = extractorFor(say(answer));
    expect(await extractor.extract(rowsChunk)).toEqual({ ok: true, rows });
  });

  test.each<[string, ClaudeMessage | Error, string | null]>([
    ["no API key", say({ rows: [] }), null],
    ["a 429 from the API", Object.assign(new Error("rate limited"), { status: 429 }), "k"],
    ["a 500 from the API", Object.assign(new Error("server error"), { status: 500 }), "k"],
    ["a refusal", { stop_reason: "refusal", content: [] }, "k"],
    ["non-JSON text", say("not json"), "k"],
    ["JSON with no rows", say({ items: [] }), "k"],
    ["rows that are not an array", say({ rows: "x" }), "k"],
    ["a row with no confidence", say({ rows: [{ ...goodRow, confidence: undefined }] }), "k"],
    ["a confidence of certain", say({ rows: [{ ...goodRow, confidence: "certain" }] }), "k"],
    ["a unit_no that is a number", say({ rows: [{ ...goodRow, unit_no: 4 }] }), "k"],
  ])("C530: %s is unavailable and logged once", async (name, answer, apiKey) => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const { extractor, requests } = extractorFor(answer, apiKey);

    expect(await extractor.extract(rowsChunk)).toEqual({ ok: false, code: "unavailable" });
    expect(log).toHaveBeenCalledTimes(1);
    if (name === "no API key") expect(requests).toHaveLength(0);
  });

  test.each<[ExtractChunk, unknown]>([
    [textChunk, { ok: false, code: "too_large" }],
    [pdfChunk, { ok: false, code: "too_large" }],
    [rowsChunk, { ok: false, code: "unavailable" }],
  ])("C531: an answer that stops at the output limit for a %j chunk", async (chunk, expected) => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { extractor } = extractorFor({ stop_reason: "max_tokens", content: [{ type: "text", text: '{"rows": [' }] });

    expect(await extractor.extract(chunk)).toEqual(expected);
  });

  test.each<[string, ExtractChunk, ExtractChunk]>([
    ["rows", rowsChunk, { ...rowsChunk, table: "Other", rows: [{ ref: "Other!2", cells: ["X", "Y"] }] }],
    ["text", textChunk, { kind: "text", text: "something else entirely" }],
    ["pdf", pdfChunk, { kind: "pdf", bytes: new Uint8Array([1, 2, 3]) }],
  ])("C538: two %s chunks make requests that differ only in messages", async (_name, a, b) => {
    const first = extractorFor(say({ rows: [] }));
    const second = extractorFor(say({ rows: [] }));
    await first.extractor.extract(a);
    await second.extractor.extract(b);

    const { messages: m1, ...rest1 } = first.requests[0];
    const { messages: m2, ...rest2 } = second.requests[0];
    expect(rest1).toEqual(rest2);
    expect(JSON.stringify(m1)).not.toBe(JSON.stringify(m2));
    expect(m1).toHaveLength(1);
    expect((m1 as { role: string }[])[0].role).toBe("user");
    expect(rest1).not.toHaveProperty("metadata");
    expect(rest1.system).toBe(SYSTEM_PROMPT);
    expect(claudeAssetExtractor({ apiKey: "k" }).extract).toHaveLength(1);
  });

  test("C553: the request uses the planned model, effort and fallback and none of the removed parameters", async () => {
    const { extractor, requests } = extractorFor(say({ rows: [] }));
    await extractor.extract(rowsChunk);
    const request = requests[0];

    expect(request.model).toBe("claude-opus-5-5");
    expect((request.output_config as { effort: string }).effort).toBe("low");
    for (const removed of ["temperature", "top_p", "top_k", "tool_choice", "thinking"]) expect(request).not.toHaveProperty(removed);
    expect(request.fallbacks).toBe("default");
    expect(request.betas).toEqual(["server-side-fallback-2026-07-01"]);
    expect(request.max_tokens as number).toBeGreaterThanOrEqual(16000);
  });
});
