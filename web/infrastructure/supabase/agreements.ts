import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { LIVE_STATUSES, MAX_SERVICE_LINES, parseServiceScope, type AgreementStatus } from "@/domain/agreement";
import type { ContractStatus } from "@/domain/contract";
import { isUuid } from "@/domain/imports";
import { cents, lineAnnualCents, sumCents } from "@/domain/money";
import { pipelineStage } from "@/domain/pipeline";
import type {
  AgreementReader,
  AgreementServiceScope,
  AgreementStore,
  ServiceLineStore,
  ServiceLineView,
  ServiceLineWriteResult,
  WriteFailure,
} from "@/application/ports";
import type { Database } from "./database.types";

type Client = SupabaseClient<Database>;

/** Raised by `service_lines_frozen` when the line's version is not the current one of a draft (door 4). */
const FROZEN = "55000";

function failure(what: string, error: Pick<PostgrestError, "code" | "message">): { ok: false; code: WriteFailure | "locked" } {
  if (error.code === FROZEN) return { ok: false, code: "locked" };
  if (error.code === "42501") return { ok: false, code: "forbidden" };
  if (error.code === "23503") return { ok: false, code: "not_found" };
  console.error(`${what} failed: ${error.code} ${error.message}`);
  return { ok: false, code: "unavailable" };
}

function unavailable(what: string, cause: unknown): { ok: false; code: "unavailable" } {
  console.error(`${what} failed: ${cause instanceof Error ? cause.message : String(cause)}`);
  return { ok: false, code: "unavailable" };
}

type VersionRow = { id: string; version_no: number; created_at: string; contracts: { status: string }[] };

type AgreementRow = {
  id: string;
  number: string | null;
  status: string;
  sites: { id: string; name: string; customers: { id: string; name: string } };
  agreement_versions: VersionRow[];
};

type LineRow = { id: string; position: number; description: string; visits_per_year: number; cost_per_visit_cents: number; created_at: string };

/** An empty object is the placeholder of a version that never recorded a scope. */
const isPlaceholder = (value: unknown) =>
  value === null || (typeof value === "object" && !Array.isArray(value) && Object.keys(value as object).length === 0);

export function supabaseAgreementReader(client: Client): AgreementReader {
  /** Live from the site while the version is editable; otherwise what the version recorded (service-included door 4). */
  async function serviceScope(siteId: string, versionId: string | undefined, editable: boolean): Promise<AgreementServiceScope> {
    let document: unknown;
    if (editable) {
      const { data, error } = await client.rpc("site_service_scope", { p_site_id: siteId });
      if (error) throw new Error(`Supabase error ${error.code}: ${error.message}`);
      document = data;
    } else {
      if (!versionId) return { source: "not_recorded" };
      const { data, error } = await client.from("agreement_versions").select("snapshot").eq("id", versionId).maybeSingle();
      if (error) throw new Error(`Supabase error ${error.code}: ${error.message}`);
      if (isPlaceholder(data?.snapshot ?? null)) return { source: "not_recorded" };
      document = data?.snapshot;
    }
    const scope = parseServiceScope(document);
    if (!scope) {
      console.error(`The service scope of ${editable ? `site ${siteId}` : `version ${versionId}`} is not a scope document`);
      return { source: "not_recorded" };
    }
    return { source: editable ? "live" : "frozen", takenAt: scope.takenAt === null ? null : new Date(scope.takenAt), types: scope.types };
  }

  return {
    async get(id, versionNo) {
      if (!isUuid(id)) return null;
      const { data, error } = await client
        .from("agreements")
        .select("id, number, status, sites(id, name, customers(id, name)), agreement_versions(id, version_no, created_at, contracts(status))")
        .eq("id", id)
        .maybeSingle();
      if (error) throw new Error(`Supabase error ${error.code}: ${error.message}`);
      if (!data) return null;

      const row = data as unknown as AgreementRow;
      const versions = [...row.agreement_versions].sort((a, b) => b.version_no - a.version_no);
      const latest = versions[0];
      const shownVersion = versions.find((version) => version.version_no === versionNo) ?? latest;

      let lines: ServiceLineView[] = [];
      if (shownVersion) {
        const { data: lineRows, error: lineError } = await client
          .from("service_lines")
          .select("id, position, description, visits_per_year, cost_per_visit_cents, created_at")
          .eq("agreement_version_id", shownVersion.id)
          .order("position", { ascending: true })
          .order("created_at", { ascending: true });
        if (lineError) throw new Error(`Supabase error ${lineError.code}: ${lineError.message}`);
        lines = [...((lineRows ?? []) as LineRow[])]
          .sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at))
          .map((line) => ({
            id: line.id,
            position: line.position,
            description: line.description,
            visitsPerYear: line.visits_per_year,
            costPerVisitCents: line.cost_per_visit_cents,
            annualCents: lineAnnualCents(line.visits_per_year, cents(line.cost_per_visit_cents)),
          }));
      }

      const status = row.status as AgreementStatus;
      const current = shownVersion !== undefined && shownVersion === latest;
      const editable = status === "draft" && current;
      return {
        id: row.id,
        number: row.number ?? "",
        status,
        stage: pipelineStage(status, latest?.contracts[0]?.status as ContractStatus | undefined),
        site: { id: row.sites.id, name: row.sites.name },
        customer: { id: row.sites.customers.id, name: row.sites.customers.name },
        versions: versions.map((version) => ({ versionNo: version.version_no, createdAt: new Date(version.created_at) })),
        shown: {
          versionNo: shownVersion?.version_no ?? 1,
          current,
          lines,
          annualCents: sumCents(lines.map((line) => cents(line.annualCents))),
        },
        editable,
        serviceScope: await serviceScope(row.sites.id, shownVersion?.id, editable),
      };
    },
  };
}

export function supabaseAgreementStore(client: Client): AgreementStore {
  return {
    async create(siteId) {
      try {
        const { data, error } = await client.rpc("create_agreement", { p_site_id: siteId });
        if (!error) return { ok: true, id: data };
        if (error.code === "P0002") return { ok: false, code: "not_found" };
        if (error.code === "42501") return { ok: false, code: "forbidden" };
        if (error.code !== "23505") return unavailable("Creating an agreement", `${error.code} ${error.message}`);

        // The site already has a live agreement (door 2): name it, so the writer can open it.
        const { data: live, error: readError } = await client
          .from("agreements")
          .select("id, number")
          .eq("site_id", siteId)
          .in("status", [...LIVE_STATUSES])
          .maybeSingle();
        if (readError) return unavailable("Reading the site's live agreement", `${readError.code} ${readError.message}`);
        if (!live) return unavailable("Reading the site's live agreement", "no live agreement after a 23505");
        return { ok: false, code: "open_exists", agreementId: live.id, number: live.number ?? "" };
      } catch (cause) {
        return unavailable("Creating an agreement", cause);
      }
    },
  };
}

export function supabaseServiceLineStore(client: Client): ServiceLineStore {
  /** One line's write as the member; RLS hides other orgs' lines, so no row back is `not_found`. */
  async function written(what: string, query: PromiseLike<{ data: { id: string }[] | null; error: PostgrestError | null }>): Promise<ServiceLineWriteResult> {
    const { data, error } = await query;
    if (error) return failure(what, error);
    return (data ?? []).length > 0 ? { ok: true } : { ok: false, code: "not_found" };
  }

  return {
    async add(agreementId, value) {
      try {
        const { data: version, error } = await client
          .from("agreement_versions")
          .select("id, org_id")
          .eq("agreement_id", agreementId)
          .order("version_no", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (error) return failure("Adding a service line", error);
        if (!version) return { ok: false, code: "not_found" };

        const { data: positions, error: positionsError } = await client
          .from("service_lines")
          .select("position")
          .eq("agreement_version_id", version.id);
        if (positionsError) return failure("Adding a service line", positionsError);
        if ((positions ?? []).length >= MAX_SERVICE_LINES) return { ok: false, code: "too_many" };

        const { data, error: insertError } = await client
          .from("service_lines")
          .insert({
            org_id: version.org_id,
            agreement_version_id: version.id,
            position: Math.max(-1, ...(positions ?? []).map((line) => line.position)) + 1,
            description: value.description,
            visits_per_year: value.visitsPerYear,
            cost_per_visit_cents: value.costPerVisitCents,
          })
          .select("id");
        if (insertError) return failure("Adding a service line", insertError);
        const id = data?.[0]?.id;
        return id ? { ok: true, id } : unavailable("Adding a service line", "the insert returned no row");
      } catch (cause) {
        return unavailable("Adding a service line", cause);
      }
    },

    async update(lineId, value) {
      try {
        return await written(
          "Saving a service line",
          client
            .from("service_lines")
            .update({ description: value.description, visits_per_year: value.visitsPerYear, cost_per_visit_cents: value.costPerVisitCents })
            .eq("id", lineId)
            .select("id"),
        );
      } catch (cause) {
        return unavailable("Saving a service line", cause);
      }
    },

    async remove(lineId) {
      try {
        return await written("Removing a service line", client.from("service_lines").delete().eq("id", lineId).select("id"));
      } catch (cause) {
        return unavailable("Removing a service line", cause);
      }
    },
  };
}
