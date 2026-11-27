import { describe, expect, it } from "vitest";
import { AI_TOOLS } from "../ai-tools";
import { API_ROUTES, openApiDocument, resolveRoute, statusForFailure } from ".";

const ID = "3f2b1c4e-5a6d-4e7f-8a9b-0c1d2e3f4a5b";

describe("public API routes", () => {
  it("maps every route to a real tool, and every tool has a route", () => {
    for (const route of API_ROUTES) expect(AI_TOOLS.some((tool) => tool.name === route.tool)).toBe(true);
    for (const tool of AI_TOOLS) expect(API_ROUTES.some((route) => route.tool === tool.name)).toBe(true);
  });
  it("turns query strings into typed arguments", () => {
    expect(resolveRoute("GET", "/customers", { query: "acme", limit: "5" }, undefined)).toMatchObject({ ok: true, tool: "search_customers", args: { query: "acme", limit: 5 } });
    expect(resolveRoute("GET", "/agreements", { expiring_soon: "true" }, undefined)).toMatchObject({ args: { expiring_soon: true } });
  });
  it("matches the literal segment before the id", () => {
    expect(resolveRoute("GET", "/agreements/expiring", { within_days: "30" }, undefined)).toMatchObject({ tool: "get_expiring_agreements", args: { within_days: 30 } });
    expect(resolveRoute("GET", `/agreements/${ID}`, {}, undefined)).toMatchObject({ tool: "get_agreement", args: { agreement_id: ID } });
  });
  it("lets the path win over the body, and passes unknown keys through for the strict check", () => {
    const other = "11111111-1111-4111-8111-111111111111";
    expect(resolveRoute("POST", `/agreements/${ID}/service-lines`, {}, { agreement_id: other })).toMatchObject({ args: { agreement_id: ID } });
    expect(resolveRoute("POST", "/agreements", {}, { site_id: ID, org_id: other })).toMatchObject({ args: { site_id: ID, org_id: other } });
    expect(resolveRoute("GET", "/customers", { org_id: other }, undefined)).toMatchObject({ args: { org_id: other } });
  });
  it("answers 404 for an unknown path, 405 for a wrong method, 400 for a non-object body", () => {
    expect(resolveRoute("GET", "/nope", {}, undefined)).toMatchObject({ ok: false, status: 404 });
    expect(resolveRoute("POST", "/me", {}, {})).toMatchObject({ ok: false, status: 405 });
    expect(resolveRoute("POST", "/agreements", {}, [1])).toMatchObject({ ok: false, status: 400 });
  });
  it("marks write routes as writes", () => {
    expect(resolveRoute("POST", "/agreements", {}, { site_id: ID })).toMatchObject({ access: "write" });
  });
  it("maps failures to statuses", () => {
    expect(statusForFailure("No agreement with that id.")).toBe(404);
    expect(statusForFailure("Your role, or this server, does not allow that tool.")).toBe(403);
    expect(statusForFailure("That site already has a live agreement (SP-1); open it instead.")).toBe(409);
    expect(statusForFailure("query must be text of at most 100 characters.")).toBe(400);
    expect(statusForFailure("That could not be read right now. Try again in a moment.")).toBe(502);
  });
});

describe("OpenAPI document", () => {
  const doc = openApiDocument("https://servicepacts.com/") as { openapi: string; servers: { url: string }[]; paths: Record<string, Record<string, { operationId: string; parameters?: unknown[] }>> };
  it("describes every route once", () => {
    expect(doc.openapi).toBe("3.1.0");
    expect(doc.servers[0].url).toBe("https://servicepacts.com/api/v1");
    expect(Object.values(doc.paths).flatMap((methods) => Object.values(methods))).toHaveLength(API_ROUTES.length);
  });
  it("lists the path id as a required path parameter", () => {
    expect(doc.paths["/agreements/{agreement_id}"].get.parameters).toContainEqual(expect.objectContaining({ name: "agreement_id", in: "path", required: true }));
  });
});
