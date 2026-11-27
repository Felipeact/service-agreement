/**
 * The tools an AI client may call on a member's behalf (MCP door 1): their names, what each does, and how their arguments are
 * checked. The catalogue is server-owned: a model only ever asks, and everything it sends is untrusted. A tool never takes an org,
 * user, role or admin flag from the caller; the org comes from the member's own session, so it cannot be changed by an argument.
 * Nothing here reads a clock, the database or the network.
 */
import { STATUS_FILTER_VALUES, type StatusFilterValue } from "../agreement/list-filter";
import { isUuid } from "../imports";
import { isIsoDate } from "../reports";

export type ToolAccess = "read" | "write";

/** The JSON Schema an MCP client is shown for a tool's arguments. */
export type ToolInputSchema = {
  type: "object";
  properties: Record<string, unknown>;
  required?: string[];
  additionalProperties: false;
};

export type ToolDefinition = {
  name: string;
  title: string;
  description: string;
  access: ToolAccess;
  inputSchema: ToolInputSchema;
};

export const MAX_RESULTS = 25;
export const DEFAULT_RESULTS = 10;
export const MAX_QUERY_LENGTH = 100;
export const EXPIRY_WINDOWS = [30, 60, 90] as const;
export type ExpiryWindow = (typeof EXPIRY_WINDOWS)[number];

const limitProperty = { type: "integer", minimum: 1, maximum: MAX_RESULTS, description: `How many results, at most ${MAX_RESULTS}. Default ${DEFAULT_RESULTS}.` };
const queryProperty = (what: string) => ({ type: "string", maxLength: MAX_QUERY_LENGTH, description: what });
const idProperty = (what: string) => ({ type: "string", format: "uuid", description: what });
const none: ToolInputSchema = { type: "object", properties: {}, additionalProperties: false };

/** The catalogue, in the order a client lists it. Reads first; the two writes only start or fill a draft, never send or cancel. */
export const AI_TOOLS: readonly ToolDefinition[] = [
  {
    name: "who_am_i",
    title: "Who am I",
    description: "The signed-in member's email, role and company, and whether they may create drafts. Call this first to see what you may do.",
    access: "read",
    inputSchema: none,
  },
  {
    name: "search_customers",
    title: "Search customers",
    description: "List the company's customers, optionally those whose name, contact or agreement number contains the query. Returns each customer's id, primary contact and how many agreements they have.",
    access: "read",
    inputSchema: { type: "object", properties: { query: queryProperty("Part of a customer name, contact name or agreement number."), limit: limitProperty }, additionalProperties: false },
  },
  {
    name: "get_customer",
    title: "Get customer",
    description: "One customer with their contacts, sites and agreements (numbers, status).",
    access: "read",
    inputSchema: { type: "object", properties: { customer_id: idProperty("The customer's id from search_customers.") }, required: ["customer_id"], additionalProperties: false },
  },
  {
    name: "search_sites_and_equipment",
    title: "Search sites and equipment",
    description: "Find customers, sites and equipment units whose name, address or unit number contains the query.",
    access: "read",
    inputSchema: { type: "object", properties: { query: queryProperty("What to look for.") }, required: ["query"], additionalProperties: false },
  },
  {
    name: "search_agreements",
    title: "Search agreements",
    description: "List service agreements, newest change first, with number, status, customer, site, yearly value and term end. Filter by status, site, or only those ending soon.",
    access: "read",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string", enum: [...STATUS_FILTER_VALUES], description: "A pipeline stage, or expired or withdrawn." },
        site_id: idProperty("Only agreements on this site."),
        expiring_soon: { type: "boolean", description: "Only agreements whose term ends soon." },
        query: queryProperty("Part of an agreement number, customer or site name."),
        limit: limitProperty,
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_agreement",
    title: "Get agreement",
    description: "One agreement: status, customer, site, current version, service lines with visits and price, and its history.",
    access: "read",
    inputSchema: { type: "object", properties: { agreement_id: idProperty("The agreement's id from search_agreements.") }, required: ["agreement_id"], additionalProperties: false },
  },
  {
    name: "get_expiring_agreements",
    title: "Get expiring agreements",
    description: "Agreements whose term ends within 30, 60 or 90 days, soonest first, split into auto-renew and negotiate. Yearly values are hidden from members who may not see money.",
    access: "read",
    inputSchema: { type: "object", properties: { within_days: { type: "integer", enum: [...EXPIRY_WINDOWS], description: "Default 90." } }, additionalProperties: false },
  },
  {
    name: "get_revenue_summary",
    title: "Get revenue summary",
    description: "Recurring revenue, pipeline value, signed, accepted, refused and expired counts for a date range, and the top customers by yearly value. Money is hidden from members who may not see it. Default range: the last 12 months.",
    access: "read",
    inputSchema: {
      type: "object",
      properties: { from: { type: "string", format: "date", description: "First day, YYYY-MM-DD." }, to: { type: "string", format: "date", description: "Last day, YYYY-MM-DD." } },
      additionalProperties: false,
    },
  },
  {
    name: "create_agreement_draft",
    title: "Create agreement draft",
    description: "Start a draft agreement on an active site that has no live agreement. It is only a draft: nothing is sent to the customer. Owners, admins and estimators only; the plan's live agreement limit applies.",
    access: "write",
    inputSchema: { type: "object", properties: { site_id: idProperty("The site's id from search_sites_and_equipment or get_customer.") }, required: ["site_id"], additionalProperties: false },
  },
  {
    name: "generate_service_lines",
    title: "Generate service lines",
    description: "Fill a draft agreement's service lines from the equipment on its site, using the standard plan. Safe to repeat: covered equipment is skipped. A draft only; a sent agreement is locked. Owners, admins and estimators only.",
    access: "write",
    inputSchema: { type: "object", properties: { agreement_id: idProperty("The draft agreement's id.") }, required: ["agreement_id"], additionalProperties: false },
  },
] as const;

export const toolByName = (name: string): ToolDefinition | undefined => AI_TOOLS.find((tool) => tool.name === name);

/** A call whose arguments passed validation. */
export type ToolCall =
  | { tool: "who_am_i" }
  | { tool: "search_customers"; query: string; limit: number }
  | { tool: "get_customer"; customerId: string }
  | { tool: "search_sites_and_equipment"; query: string }
  | { tool: "search_agreements"; status?: StatusFilterValue; siteId?: string; expiringSoon: boolean; query: string; limit: number }
  | { tool: "get_agreement"; agreementId: string }
  | { tool: "get_expiring_agreements"; withinDays: ExpiryWindow }
  | { tool: "get_revenue_summary"; from?: string; to?: string }
  | { tool: "create_agreement_draft"; siteId: string }
  | { tool: "generate_service_lines"; agreementId: string };

export type ParsedCall = { ok: true; call: ToolCall } | { ok: false; error: string };

const fail = (error: string): ParsedCall => ({ ok: false, error });

/**
 * Checks what a model sent for a tool against the catalogue. Strict: an argument the tool does not declare (including `org_id`,
 * `user_id`, `role` or `is_admin`) is refused, not ignored, so a model cannot even attempt to name its own authority.
 */
export function parseToolCall(name: string, args: unknown): ParsedCall {
  const tool = toolByName(name);
  if (!tool) return fail(`Unknown tool "${name.slice(0, 60)}".`);
  if (args !== undefined && (typeof args !== "object" || args === null || Array.isArray(args))) return fail("Arguments must be an object.");
  const input = (args ?? {}) as Record<string, unknown>;
  const allowed = new Set(Object.keys(tool.inputSchema.properties));
  const extra = Object.keys(input).find((key) => !allowed.has(key));
  if (extra !== undefined) return fail(`"${extra.slice(0, 40)}" is not an argument of ${name}. Who you act for comes from your sign-in, never from an argument.`);

  const text = (key: string, { required = false }: { required?: boolean } = {}): string | null | undefined => {
    const value = input[key];
    if (value === undefined || value === null) return required ? null : "";
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    if (trimmed.length > MAX_QUERY_LENGTH) return null;
    return required && trimmed === "" ? null : trimmed;
  };
  const id = (key: string): string | null => {
    const value = input[key];
    return typeof value === "string" && isUuid(value.trim()) ? value.trim().toLowerCase() : null;
  };
  const limit = (): number | null => {
    const value = input.limit;
    if (value === undefined) return DEFAULT_RESULTS;
    return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= MAX_RESULTS ? value : null;
  };

  switch (name) {
    case "who_am_i":
      return { ok: true, call: { tool: "who_am_i" } };
    case "search_customers": {
      const query = text("query");
      const count = limit();
      if (query === null) return fail(`query must be text of at most ${MAX_QUERY_LENGTH} characters.`);
      if (count === null) return fail(`limit must be a whole number from 1 to ${MAX_RESULTS}.`);
      return { ok: true, call: { tool: "search_customers", query: query ?? "", limit: count } };
    }
    case "get_customer": {
      const customerId = id("customer_id");
      return customerId ? { ok: true, call: { tool: "get_customer", customerId } } : fail("customer_id must be a customer id.");
    }
    case "search_sites_and_equipment": {
      const query = text("query", { required: true });
      return query ? { ok: true, call: { tool: "search_sites_and_equipment", query } } : fail(`query is required, at most ${MAX_QUERY_LENGTH} characters.`);
    }
    case "search_agreements": {
      const query = text("query");
      const count = limit();
      if (query === null) return fail(`query must be text of at most ${MAX_QUERY_LENGTH} characters.`);
      if (count === null) return fail(`limit must be a whole number from 1 to ${MAX_RESULTS}.`);
      let status: StatusFilterValue | undefined;
      if (input.status !== undefined) {
        if (typeof input.status !== "string" || !(STATUS_FILTER_VALUES as readonly string[]).includes(input.status)) return fail(`status must be one of: ${STATUS_FILTER_VALUES.join(", ")}.`);
        status = input.status as StatusFilterValue;
      }
      let siteId: string | undefined;
      if (input.site_id !== undefined) {
        const parsed = id("site_id");
        if (!parsed) return fail("site_id must be a site id.");
        siteId = parsed;
      }
      if (input.expiring_soon !== undefined && typeof input.expiring_soon !== "boolean") return fail("expiring_soon must be true or false.");
      return { ok: true, call: { tool: "search_agreements", status, siteId, expiringSoon: input.expiring_soon === true, query: query ?? "", limit: count } };
    }
    case "get_agreement": {
      const agreementId = id("agreement_id");
      return agreementId ? { ok: true, call: { tool: "get_agreement", agreementId } } : fail("agreement_id must be an agreement id.");
    }
    case "get_expiring_agreements": {
      const days = input.within_days ?? 90;
      return typeof days === "number" && (EXPIRY_WINDOWS as readonly number[]).includes(days)
        ? { ok: true, call: { tool: "get_expiring_agreements", withinDays: days as ExpiryWindow } }
        : fail("within_days must be 30, 60 or 90.");
    }
    case "get_revenue_summary": {
      const { from, to } = input;
      if ((from !== undefined && (typeof from !== "string" || !isIsoDate(from))) || (to !== undefined && (typeof to !== "string" || !isIsoDate(to)))) return fail("from and to must be dates as YYYY-MM-DD.");
      if (typeof from === "string" && typeof to === "string" && from > to) return fail("from must not be after to.");
      return { ok: true, call: { tool: "get_revenue_summary", from: from as string | undefined, to: to as string | undefined } };
    }
    case "create_agreement_draft": {
      const siteId = id("site_id");
      return siteId ? { ok: true, call: { tool: "create_agreement_draft", siteId } } : fail("site_id must be a site id.");
    }
    case "generate_service_lines": {
      const agreementId = id("agreement_id");
      return agreementId ? { ok: true, call: { tool: "generate_service_lines", agreementId } } : fail("agreement_id must be an agreement id.");
    }
    default:
      return fail(`Unknown tool "${name.slice(0, 60)}".`);
  }
}

/** Whether a member's role may run a tool. Reads are open to every role; the two writes follow the records rule (owner, admin, estimator). */
export function mayRunTool(access: ToolAccess, canWrite: boolean, writesEnabled: boolean): boolean {
  return access === "read" || (canWrite && writesEnabled);
}
