/**
 * The public REST API (API door 1): which URL runs which tool, how a request's parts become the tool's arguments, and the OpenAPI
 * document that describes it. The API is a thin face on the shared tool layer ([ai-tools](../ai-tools/index.ts)), so the checks, the
 * role rules and the audit are the ones MCP already has. Nothing here reads a clock, the database or the network.
 */
import { AI_TOOLS, toolByName, type ToolAccess } from "../ai-tools";

export type HttpMethod = "GET" | "POST";

export type ApiRoute = {
  method: HttpMethod;
  /** Relative to `/api/v1`; `{name}` is a path parameter. */
  path: string;
  tool: string;
  summary: string;
};

/** Order matters: a literal segment (`expiring`) must come before the `{agreement_id}` that would also match it. */
export const API_ROUTES: readonly ApiRoute[] = [
  { method: "GET", path: "/me", tool: "who_am_i", summary: "Who the credential acts as, and what it may do" },
  { method: "GET", path: "/customers", tool: "search_customers", summary: "List customers" },
  { method: "GET", path: "/customers/{customer_id}", tool: "get_customer", summary: "One customer with contacts, sites and agreements" },
  { method: "GET", path: "/search", tool: "search_sites_and_equipment", summary: "Find customers, sites and equipment" },
  { method: "GET", path: "/agreements", tool: "search_agreements", summary: "List agreements" },
  { method: "GET", path: "/agreements/expiring", tool: "get_expiring_agreements", summary: "Agreements ending within 30, 60 or 90 days" },
  { method: "GET", path: "/agreements/{agreement_id}", tool: "get_agreement", summary: "One agreement with lines and history" },
  { method: "GET", path: "/reports/revenue", tool: "get_revenue_summary", summary: "Revenue and pipeline summary" },
  { method: "POST", path: "/agreements", tool: "create_agreement_draft", summary: "Start a draft agreement on a site" },
  { method: "POST", path: "/agreements/{agreement_id}/service-lines", tool: "generate_service_lines", summary: "Fill a draft's service lines from site equipment" },
];

export const API_VERSION = "v1";
export const API_BASE_PATH = `/api/${API_VERSION}`;

export type ResolvedRoute = { ok: true; tool: string; access: ToolAccess; args: Record<string, unknown> } | { ok: false; status: 400 | 404 | 405; error: string };

const segmentsOf = (path: string) => path.split("/").filter(Boolean);

function matchPath(route: ApiRoute, segments: string[]): Record<string, string> | null {
  const pattern = segmentsOf(route.path);
  if (pattern.length !== segments.length) return null;
  const params: Record<string, string> = {};
  for (let index = 0; index < pattern.length; index += 1) {
    const part = pattern[index];
    if (part.startsWith("{")) params[part.slice(1, -1)] = segments[index];
    else if (part !== segments[index]) return null;
  }
  return params;
}

/** A query string value, turned into what the tool's schema says the argument is. Anything that does not fit stays text, so the strict check refuses it. */
function coerce(tool: string, key: string, value: string): unknown {
  const property = toolByName(tool)?.inputSchema.properties[key] as { type?: string } | undefined;
  if (property?.type === "integer" && /^-?\d{1,9}$/.test(value)) return Number(value);
  if (property?.type === "boolean" && (value === "true" || value === "false")) return value === "true";
  return value;
}

/**
 * Finds the route for a request and builds the tool arguments. Path parameters win over anything in the query or body, and a
 * parameter the tool does not declare is passed through so the strict argument check refuses it (an `org_id` is never ignored).
 */
export function resolveRoute(method: string, path: string, query: Record<string, string>, body: unknown): ResolvedRoute {
  const segments = segmentsOf(path);
  let pathMatched = false;
  for (const route of API_ROUTES) {
    const params = matchPath(route, segments);
    if (!params) continue;
    pathMatched = true;
    if (route.method !== method) continue;
    const definition = toolByName(route.tool);
    if (!definition) return { ok: false, status: 404, error: "Not found." };
    if (method === "POST") {
      if (body !== undefined && body !== null && (typeof body !== "object" || Array.isArray(body))) return { ok: false, status: 400, error: "The body must be a JSON object." };
      return { ok: true, tool: route.tool, access: definition.access, args: { ...((body as Record<string, unknown> | null | undefined) ?? {}), ...params } };
    }
    const args: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(query)) args[key] = coerce(route.tool, key, value);
    return { ok: true, tool: route.tool, access: definition.access, args: { ...args, ...params } };
  }
  return pathMatched ? { ok: false, status: 405, error: "That method is not allowed on this path." } : { ok: false, status: 404, error: "Not found." };
}

/** Maps a tool failure message to an HTTP status: the tool layer words its refusals, and these are the stable shapes. */
export function statusForFailure(message: string): 400 | 403 | 404 | 409 | 502 {
  if (message.startsWith("No ")) return 404;
  if (/allow|role may not|does not allow|plan and above/i.test(message)) return 403;
  if (/already|limit|locked/i.test(message)) return 409;
  if (/could not be read|could not be built|right now/i.test(message)) return 502;
  return 400;
}

type Schema = Record<string, unknown>;

/** The OpenAPI 3.1 document for the API, generated from the same catalogue the checks use so it cannot drift. */
export function openApiDocument(baseUrl: string): Schema {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const route of API_ROUTES) {
    const definition = AI_TOOLS.find((tool) => tool.name === route.tool);
    if (!definition) continue;
    const pathParams = segmentsOf(route.path).filter((part) => part.startsWith("{")).map((part) => part.slice(1, -1));
    const properties = definition.inputSchema.properties as Record<string, Schema>;
    const parameters: Schema[] = pathParams.map((name) => ({ name, in: "path", required: true, schema: properties[name] ?? { type: "string", format: "uuid" } }));
    const operation: Schema = {
      operationId: route.tool,
      summary: route.summary,
      description: definition.description,
      tags: [definition.access === "write" ? "Drafts" : "Reads"],
      security: [{ bearerAuth: [] }],
      responses: {
        [route.method === "POST" ? "201" : "200"]: { description: "The result.", content: { "application/json": { schema: { $ref: "#/components/schemas/Data" } } } },
        "400": { $ref: "#/components/responses/Error" },
        "401": { $ref: "#/components/responses/Error" },
        "403": { $ref: "#/components/responses/Error" },
        "404": { $ref: "#/components/responses/Error" },
        "429": { $ref: "#/components/responses/Error" },
      },
    };
    if (route.method === "GET") {
      for (const [name, schema] of Object.entries(properties)) if (!pathParams.includes(name)) parameters.push({ name, in: "query", required: definition.inputSchema.required?.includes(name) ?? false, schema });
    } else {
      const bodyProperties = Object.fromEntries(Object.entries(properties).filter(([name]) => !pathParams.includes(name)));
      if (Object.keys(bodyProperties).length > 0) {
        operation.requestBody = {
          required: true,
          content: { "application/json": { schema: { type: "object", properties: bodyProperties, required: (definition.inputSchema.required ?? []).filter((name) => !pathParams.includes(name)), additionalProperties: false } } },
        };
      }
    }
    if (parameters.length > 0) operation.parameters = parameters;
    (paths[route.path] ??= {})[route.method.toLowerCase()] = operation;
  }
  return {
    openapi: "3.1.0",
    info: {
      title: "Service Pacts API",
      version: API_VERSION,
      description: "Read your company's customers, sites, agreements and reports, and start draft agreements. Every call acts as the member who signed in: your company and role come from the credential, never from a parameter, and money is in dollars (CAD). Available on the Team plan (reads) and Business plan (draft writes).",
    },
    servers: [{ url: `${baseUrl.replace(/\/$/, "")}${API_BASE_PATH}` }],
    tags: [{ name: "Reads" }, { name: "Drafts" }],
    paths,
    components: {
      securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", description: "A Supabase access token for a member, obtained through the OAuth 2.1 flow at the authorization server named in `/.well-known/oauth-protected-resource/api/v1`." } },
      schemas: {
        Data: { type: "object", properties: { data: { description: "The result, shaped as the operation describes." } }, required: ["data"] },
        Error: { type: "object", properties: { error: { type: "object", properties: { message: { type: "string" } }, required: ["message"] } }, required: ["error"] },
      },
      responses: { Error: { description: "The request was refused.", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } } },
    },
  };
}
