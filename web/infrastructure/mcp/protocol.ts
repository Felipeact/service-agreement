import type { ToolDefinition } from "@/domain/ai-tools";
import type { ToolResult } from "@/application/use-cases";

/** The MCP revisions this server speaks; a client asking for another gets the newest. */
export const SUPPORTED_PROTOCOLS = ["2025-06-18", "2025-03-26", "2024-11-05"] as const;
export const SERVER_INFO = { name: "service-pacts", title: "Service Pacts", version: "1.0.0" } as const;
const INSTRUCTIONS =
  "Service Pacts tools for the signed-in member's own company. Call who_am_i first. Reads cover customers, sites, equipment, agreements, expiring agreements and revenue. The write tools add records and start drafts only: nothing is ever sent to a customer from here. To make an agreement from an equipment list: (1) search_customers and search_sites_and_equipment to see what already exists; (2) if the customer or the site is new, ASK the user for anything you do not have (the customer's company name, what to call the site, its street address) and wait for the answer before creating; (3) create_customer, then create_site, then add_equipment with the units from the list (a new equipment type is created automatically when none fits, so never stop for a missing type); (4) create_agreement_draft, then generate_service_lines. Never put equipment on a different customer's site to get around a missing one.";

/** What the protocol needs of the tool layer, so it knows nothing of the database. */
export type McpTools = {
  list(): ToolDefinition[];
  call(name: string, args: unknown): Promise<ToolResult>;
};

type Id = string | number | null;
const reply = (id: Id, result: unknown) => ({ jsonrpc: "2.0" as const, id, result });
const failure = (id: Id, code: number, message: string) => ({ jsonrpc: "2.0" as const, id, error: { code, message } });

/**
 * One JSON-RPC message of the Model Context Protocol (Streamable HTTP, single messages): initialize, ping, tools/list and tools/call.
 * A notification (no id) gets `null`: the endpoint answers 202 with no body. Anything else is a JSON-RPC error, never a throw.
 */
export async function handleMcpMessage(message: unknown, tools: McpTools): Promise<object | null> {
  if (typeof message !== "object" || message === null || Array.isArray(message)) return failure(null, -32600, "Send one JSON-RPC message.");
  const { id, method, params } = message as { id?: unknown; method?: unknown; params?: unknown };
  const hasId = typeof id === "string" || typeof id === "number";
  if (typeof method !== "string") return failure(hasId ? (id as Id) : null, -32600, "Invalid request.");
  if (!hasId) return null;
  const input = (typeof params === "object" && params !== null ? params : {}) as Record<string, unknown>;

  switch (method) {
    case "initialize": {
      const asked = typeof input.protocolVersion === "string" ? input.protocolVersion : "";
      const protocolVersion = (SUPPORTED_PROTOCOLS as readonly string[]).includes(asked) ? asked : SUPPORTED_PROTOCOLS[0];
      return reply(id as Id, { protocolVersion, capabilities: { tools: { listChanged: false } }, serverInfo: SERVER_INFO, instructions: INSTRUCTIONS });
    }
    case "ping":
      return reply(id as Id, {});
    case "tools/list":
      return reply(id as Id, {
        tools: tools.list().map((tool) => ({
          name: tool.name,
          title: tool.title,
          description: tool.description,
          inputSchema: tool.inputSchema,
          annotations: { readOnlyHint: tool.access === "read", destructiveHint: false, idempotentHint: tool.access === "read", openWorldHint: false },
        })),
      });
    case "tools/call": {
      if (typeof input.name !== "string") return failure(id as Id, -32602, "name is required.");
      const result = await tools.call(input.name, input.arguments);
      const text = result.ok ? JSON.stringify(result.data) : result.error;
      return reply(id as Id, { content: [{ type: "text", text }], isError: !result.ok });
    }
    default:
      return failure(id as Id, -32601, "Method not found.");
  }
}
