import type { AgreementLister, AgreementReader, AgreementStore, CustomerDirectory, RecordSearch, ReportReader, ToolAudit } from "@/application/ports";
import { AI_TOOLS, mayRunTool, parseToolCall, toolByName, type ToolCall, type ToolDefinition } from "@/domain/ai-tools";
import type { ReportRange } from "@/domain/reports";
import type { GenerateServiceLinesResult } from "./generate-service-lines";

/** Who is calling. Always built from the verified session, never from anything the model sent. */
export type ToolCaller = { userId: string; email: string; orgName: string; role: string; canWrite: boolean };

export type ToolResult = { ok: true; data: unknown } | { ok: false; error: string };

type Deps = {
  agreements: AgreementLister;
  agreementReader: AgreementReader;
  agreementStore: AgreementStore;
  customers: CustomerDirectory;
  records: RecordSearch;
  reports: ReportReader;
  generateServiceLines: (agreementId: string) => Promise<GenerateServiceLinesResult>;
  audit: ToolAudit;
  /** The business day, `YYYY-MM-DD`. */
  today: () => string;
  /** Switch for the write tools (`MCP_WRITE_TOOLS=off` turns them off). */
  writesEnabled: boolean;
  /** Which door the call came through, written to the audit row. */
  source: "mcp";
};

const dollars = (cents: number | null | undefined): number | null => (typeof cents === "number" ? Math.round(cents) / 100 : null);
const matches = (query: string, ...fields: (string | null | undefined)[]) => {
  const needle = query.toLowerCase();
  return needle === "" || fields.some((field) => field?.toLowerCase().includes(needle));
};
const UNAVAILABLE = { ok: false, error: "That could not be read right now. Try again in a moment." } as const;

/**
 * The shared tool dispatcher (assistant tool layer). One sequence for every call, whatever AI client sent it: the tool must exist,
 * the arguments must pass the catalogue's strict check, the caller's role must allow it (reads for anyone, the two draft writes for
 * owners, admins and estimators), and only then does it run, through the same member-scoped readers and stores the pages use, so the
 * database's row-level security still decides what exists. Each call is audited, and what comes back is the minimum the model needs.
 */
export function makeRunAiTool(deps: Deps) {
  const { agreements, agreementReader, agreementStore, customers, records, reports, audit } = deps;

  /** The tools this caller may see: every read, and the writes only when their role and the switch allow. */
  function toolsFor(caller: ToolCaller): ToolDefinition[] {
    return AI_TOOLS.filter((tool) => mayRunTool(tool.access, caller.canWrite, deps.writesEnabled));
  }

  async function execute(call: ToolCall, caller: ToolCaller): Promise<ToolResult> {
    const day = deps.today();
    switch (call.tool) {
      case "who_am_i":
        return { ok: true, data: { email: caller.email, company: caller.orgName, role: caller.role, canCreateDrafts: caller.canWrite && deps.writesEnabled } };
      case "search_customers": {
        const rows = await customers.list();
        const found = rows.filter((row) => row.active && matches(call.query, row.name, row.primaryContact, ...row.agreementNumbers)).slice(0, call.limit);
        return { ok: true, data: { count: found.length, customers: found.map((row) => ({ id: row.id, name: row.name, primaryContact: row.primaryContact, email: row.primaryEmail, phone: row.primaryPhone, sites: row.siteCount, agreements: row.agreementCount, yearlyValueCad: dollars(row.annualCents) })) } };
      }
      case "get_customer": {
        const detail = await customers.detail(call.customerId);
        if (!detail) return { ok: false, error: "No customer with that id." };
        return {
          ok: true,
          data: {
            id: detail.id,
            name: detail.name,
            active: detail.active,
            contacts: detail.contacts.map((contact) => ({ id: contact.id, name: contact.name, email: contact.email, phone: contact.phone })),
            sites: detail.sites.map((site) => ({ id: site.id, name: site.name, address: site.address, equipmentUnits: site.assetCount, active: site.active })),
            agreements: detail.agreements.map((agreement) => ({ id: agreement.id, number: agreement.number, site: agreement.siteName, stage: agreement.stage, version: agreement.versionNo, yearlyValueCad: dollars(agreement.annualCents) })),
          },
        };
      }
      case "search_sites_and_equipment": {
        const found = await records.search(call.query);
        return {
          ok: true,
          data: {
            customers: found.customers.hits,
            sites: found.sites.hits.map((site) => ({ id: site.id, name: site.name, customer: site.customerName, address: site.address })),
            equipment: found.equipment.hits.map((unit) => ({ id: unit.id, unitNo: unit.unitNo, type: unit.typeName, siteId: unit.siteId, site: unit.siteName, customer: unit.customerName })),
            more: found.customers.more || found.sites.more || found.equipment.more,
          },
        };
      }
      case "search_agreements": {
        const rows = await agreements.list({ status: call.status, siteId: call.siteId, expiring: call.expiringSoon || undefined }, day);
        const found = rows.filter((row) => matches(call.query, row.number, row.customer, row.site)).slice(0, call.limit);
        return { ok: true, data: { count: found.length, agreements: found.map((row) => ({ id: row.id, number: row.number, status: row.status, stage: row.stage, customer: row.customer, site: row.site, version: row.versionNo, yearlyValueCad: dollars(row.annualCents), termEnd: row.termEnd, updatedAt: row.updatedAt })) } };
      }
      case "get_agreement": {
        const detail = await agreementReader.get(call.agreementId);
        if (!detail) return { ok: false, error: "No agreement with that id." };
        return {
          ok: true,
          data: {
            id: detail.id,
            number: detail.number,
            status: detail.status,
            stage: detail.stage,
            customer: detail.customer,
            site: detail.site,
            editable: detail.editable,
            shownVersion: detail.shown.versionNo,
            yearlyValueCad: dollars(detail.shown.annualCents),
            lines: detail.shown.lines.map((line) => ({ description: line.description, visitsPerYear: line.visitsPerYear, costPerVisitCad: dollars(line.costPerVisitCents), yearlyCad: dollars(line.annualCents), covers: line.equipment.map((type) => type.name) })),
            history: (detail.timeline ?? []).slice(0, 15).map((entry) => ({ label: entry.label, at: entry.at.toISOString(), version: entry.versionNo, by: entry.by })),
          },
        };
      }
      case "get_expiring_agreements": {
        const result = await reports.renewals();
        if (!result.ok) return { ok: false, error: result.code === "forbidden" ? "Your role may not read this report." : UNAVAILABLE.error };
        const rows = result.value.filter((row) => row.daysLeft <= call.withinDays);
        return { ok: true, data: { withinDays: call.withinDays, count: rows.length, agreements: rows.map((row) => ({ id: row.agreementId, number: row.number, customer: row.customer, site: row.site, termEnd: row.termEnd, daysLeft: row.daysLeft, renewal: row.kind, yearlyValueCad: dollars(row.valueCents) })) } };
      }
      case "get_revenue_summary": {
        const range = rangeOf(call, day);
        const [headline, byCustomer] = await Promise.all([reports.headline(range), reports.revenueByCustomer()]);
        if (!headline.ok) return { ok: false, error: headline.code === "forbidden" ? "Your role may not read this report." : UNAVAILABLE.error };
        const top = byCustomer.ok ? byCustomer.value.slice(0, 5).map((row) => ({ customer: row.customer, agreements: row.agreements, yearlyValueCad: dollars(row.valueCents) })) : [];
        const value = headline.value;
        return { ok: true, data: { range, recurringYearlyCad: dollars(value.recurringCents), pipelineCad: dollars(value.pipelineCents), signed: value.signed, accepted: value.accepted, refused: value.refused, expired: value.expired, averageDaysToSign: value.avgDaysToSign, topCustomers: top } };
      }
      case "create_agreement_draft": {
        const created = await agreementStore.create(call.siteId);
        if (created.ok) return { ok: true, data: { agreementId: created.id, status: "draft", openAt: `/agreements/${created.id}`, note: "A draft only; nothing was sent to the customer." } };
        if (created.code === "open_exists") return { ok: false, error: `That site already has a live agreement (${created.number}); open it instead.` };
        if (created.code === "plan_limit") return { ok: false, error: `The ${created.plan} plan's limit of ${created.limit} live agreements is reached.` };
        return { ok: false, error: created.code === "forbidden" ? "Your role may not create agreements." : "No active site with that id, or it could not be created." };
      }
      case "generate_service_lines": {
        const result = await deps.generateServiceLines(call.agreementId);
        if (result.ok) return { ok: true, data: { added: result.added, openAt: `/agreements/${call.agreementId}` } };
        return { ok: false, error: result.code === "locked" ? "That agreement is already sent, so its lines are locked." : result.code === "not_found" ? "No agreement with that id." : "The service lines could not be built." };
      }
    }
  }

  /** Runs one tool call for a verified caller. Never throws: a failure is a short message, and nothing from another org can be named. */
  async function runTool(name: string, args: unknown, caller: ToolCaller): Promise<ToolResult> {
    const definition = toolByName(name);
    const parsed = parseToolCall(name, args);
    const outcome = await (async (): Promise<ToolResult> => {
      if (!definition || !parsed.ok) return { ok: false, error: parsed.ok ? "Unknown tool." : parsed.error };
      if (!mayRunTool(definition.access, caller.canWrite, deps.writesEnabled)) return { ok: false, error: "Your role, or this server, does not allow that tool." };
      try {
        return await execute(parsed.call, caller);
      } catch (cause) {
        console.error(`AI tool ${definition.name} failed: ${cause instanceof Error ? cause.name : "error"}`);
        return UNAVAILABLE;
      }
    })();
    // The audit row names the tool and the outcome, never the arguments or the answer.
    await audit.record({ tool: definition?.name ?? "unknown", source: deps.source, ok: outcome.ok }).catch(() => undefined);
    return outcome;
  }

  return { runTool, toolsFor };
}

function rangeOf(call: Extract<ToolCall, { tool: "get_revenue_summary" }>, today: string): ReportRange {
  const to = call.to ?? today;
  if (call.from) return { from: call.from, to };
  const [year, month, day] = to.split("-").map(Number);
  const from = new Date(Date.UTC(year - 1, month - 1, day + 1));
  return { from: from.toISOString().slice(0, 10), to };
}
