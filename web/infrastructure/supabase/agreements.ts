import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import {
  LIVE_STATUSES,
  TIMELINE_EVENT_TYPES,
  buildTimeline,
  parseServiceScope,
  parseTerms,
  SYSTEM_AGREEMENT_BODY,
  validateAgreementTemplate,
  type AgreementStatus,
  type AgreementTemplateBody,
  type AgreementTerms,
  type EquipmentChoice,
  type TimelineSource,
} from "@/domain/agreement";
import type { ContractStatus } from "@/domain/contract";
import { isUuid } from "@/domain/imports";
import { cents, lineAnnualCents, sumCents } from "@/domain/money";
import { pipelineStage } from "@/domain/pipeline";
import { isNotEmailedReason } from "@/domain/notifications";
import type {
  AgreementReader,
  MemberRole,
  VersionEvent,
  VersionEventType,
  VersionView,
  LinkEmailView,
  AgreementServiceScope,
  AgreementStore,
  AgreementTermStore,
  ServiceLineStore,
  ServiceLineView,
  ServiceLineWriteResult,
  VersionNoteStore,
  WriteFailure,
} from "@/application/ports";
import type { ServiceLineValue } from "@/domain/agreement";
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

type VersionRow = {
  id: string;
  version_no: number;
  created_at: string;
  term_start: string | null;
  term_months: number;
  term_end: string | null;
  valid_until: string | null;
  created_by: string | null;
  reason: string | null;
  /** Absent in an older fixture, which means the system template; `null` is a version nobody pinned (a draft, or one sent before templates). */
  template_version_id?: string | null;
  document_template_versions?: { body: unknown } | null;
  contracts: { id?: string; status: string }[];
};

type AgreementRow = {
  id: string;
  org_id: string;
  number: string | null;
  status: string;
  renews_agreement_id?: string | null;
  sites: { id: string; name: string; customers: { id: string; name: string } };
  agreement_versions: VersionRow[];
};

/** The event types the history lists, and what each is called there. */
const EVENT_KINDS: Record<string, VersionEventType> = {
  "agreement.sent": "sent",
  "agreement.viewed": "viewed",
  "agreement.accepted": "accepted",
  "agreement.refused": "refused",
  "agreement.changes_requested": "changes_requested",
};

type EventRow = { type: string; payload: { versionNo?: unknown; via?: unknown; [key: string]: unknown } | null; actor_id: string | null; created_at: string };

/**
 * The version an event is about (versioning door 5): the `versionNo` in its payload, else the newest version that
 * existed when it was written. `agreement.sent` carries no `versionNo`, and `events` cannot be backfilled.
 */
function versionOfEvent(event: EventRow, versions: VersionRow[]): number | null {
  if (typeof event.payload?.versionNo === "number") return event.payload.versionNo;
  const when = new Date(event.created_at).getTime();
  const existing = versions.filter((version) => new Date(version.created_at).getTime() <= when);
  return existing.length === 0 ? null : Math.max(...existing.map((version) => version.version_no));
}

type LinkRow = { id: string; number: string | null; renews_agreement_id: string | null };

type CoveredType = { id: string; code: string; name: string };

type LineRow = {
  id: string;
  position: number;
  description: string;
  visits_per_year: number;
  visit_months: number[];
  cost_per_visit_cents: number;
  created_at: string;
  service_line_asset_types: { asset_types: CoveredType | null }[] | null;
};

/**
 * The template version a version is pinned to. A row that never asked for the pin (an older fixture) has none; an unpinned
 * version is drawn with the system template; a pin whose version cannot be read throws, and is never drawn with other wording
 * (agreement-templates AC 14).
 */
function templateOf(version: VersionRow | undefined): AgreementTemplateBody | undefined {
  if (!version || version.template_version_id === undefined) return undefined;
  if (version.template_version_id === null) return SYSTEM_AGREEMENT_BODY;
  const checked = validateAgreementTemplate(version.document_template_versions?.body);
  if (!checked.ok) {
    throw new Error(
      `Agreement version ${version.id} has no readable template version ${version.template_version_id}: ${version.document_template_versions ? checked.reason : "it was not found"}`,
    );
  }
  return checked.body;
}

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, "en", { numeric: true, sensitivity: "base" });

/** An empty object is the placeholder of a version that never recorded a scope. */
const isPlaceholder = (value: unknown) =>
  value === null || (typeof value === "object" && !Array.isArray(value) && Object.keys(value as object).length === 0);

export function supabaseAgreementReader(client: Client): AgreementReader {
  /**
   * Live from the site while the version is editable; otherwise what the version recorded, terms included
   * (service-included door 4, customer-portal door 3).
   */
  async function recorded(
    siteId: string,
    versionId: string | undefined,
    editable: boolean,
  ): Promise<{ serviceScope: AgreementServiceScope; terms: AgreementTerms | null }> {
    let document: unknown;
    let terms: AgreementTerms | null = null;
    if (editable) {
      const { data, error } = await client.rpc("site_service_scope", { p_site_id: siteId });
      if (error) throw new Error(`Supabase error ${error.code}: ${error.message}`);
      document = data;
    } else {
      if (!versionId) return { serviceScope: { source: "not_recorded" }, terms };
      const { data, error } = await client.from("agreement_versions").select("snapshot").eq("id", versionId).maybeSingle();
      if (error) throw new Error(`Supabase error ${error.code}: ${error.message}`);
      terms = parseTerms(data?.snapshot ?? null);
      if (isPlaceholder(data?.snapshot ?? null)) return { serviceScope: { source: "not_recorded" }, terms };
      document = data?.snapshot;
    }
    const scope = parseServiceScope(document);
    if (!scope) {
      console.error(`The service scope of ${editable ? `site ${siteId}` : `version ${versionId}`} is not a scope document`);
      return { serviceScope: { source: "not_recorded" }, terms };
    }
    return {
      serviceScope: { source: editable ? "live" : "frozen", takenAt: scope.takenAt === null ? null : new Date(scope.takenAt), types: scope.types },
      terms,
    };
  }

  /** When the customer first opened the live link of a sent agreement's current version. */
  async function portalLink(versionId: string | undefined, status: AgreementStatus, current: boolean) {
    if (!versionId || status !== "sent" || !current) return null;
    const { data, error } = await client
      .from("portal_links")
      .select("first_viewed_at")
      .eq("agreement_version_id", versionId)
      .is("revoked_at", null)
      .maybeSingle();
    if (error) throw new Error(`Supabase error ${error.code}: ${error.message}`);
    if (!data) return null;
    return { firstViewedAt: data.first_viewed_at === null ? null : new Date(data.first_viewed_at) };
  }

  /**
   * The `customer_link` notification of the agreement's latest `agreement.sent` event, which is the current version's
   * (outbox-dispatch AC 30). A `claimed` one, or none, is still pending.
   */
  async function linkEmail(agreementId: string, status: AgreementStatus, current: boolean): Promise<LinkEmailView | null> {
    if (status !== "sent" || !current) return null;
    const { data: event, error } = await client
      .from("events")
      .select("id")
      .eq("entity_type", "agreement")
      .eq("entity_id", agreementId)
      .eq("type", "agreement.sent")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(`Supabase error ${error.code}: ${error.message}`);
    if (!event) return { status: "pending" };
    const { data: row, error: rowError } = await client
      .from("notifications")
      .select("status, skip_reason, recipients, sent_at")
      .eq("event_id", event.id)
      .eq("kind", "customer_link")
      .maybeSingle();
    if (rowError) throw new Error(`Supabase error ${rowError.code}: ${rowError.message}`);
    if (row?.status === "sent" && row.sent_at) return { status: "sent", to: row.recipients[0] ?? "", sentAt: new Date(row.sent_at) };
    if (row?.status === "failed") return { status: "not_sent", reason: "failed" };
    if (row?.status === "skipped" && row.skip_reason && isNotEmailedReason(row.skip_reason)) return { status: "not_sent", reason: row.skip_reason };
    return { status: "pending" };
  }

  /** The lines of one version, by position and then creation time, with their annual amounts. */
  async function linesOf(versionId: string): Promise<ServiceLineView[]> {
    const { data: lineRows, error: lineError } = await client
      .from("service_lines")
      .select("id, position, description, visits_per_year, visit_months, cost_per_visit_cents, created_at, service_line_asset_types(asset_types(id, code, name))")
      .eq("agreement_version_id", versionId)
      .order("position", { ascending: true })
      .order("created_at", { ascending: true });
    if (lineError) throw new Error(`Supabase error ${lineError.code}: ${lineError.message}`);
    return [...((lineRows ?? []) as LineRow[])]
      .sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at))
      .map((line) => ({
        id: line.id,
        position: line.position,
        description: line.description,
        visitsPerYear: line.visits_per_year,
        costPerVisitCents: line.cost_per_visit_cents,
        annualCents: lineAnnualCents(line.visits_per_year, cents(line.cost_per_visit_cents)),
        visitMonths: [...(line.visit_months ?? [])],
        equipment: (line.service_line_asset_types ?? [])
          .flatMap((cover) => (cover.asset_types ? [cover.asset_types] : []))
          .map((type) => ({ id: type.id, code: type.code, name: type.name }))
          .sort(byName),
      }));
  }

  /**
   * Each version with its reason, its author's role and its sent, viewed and decided events, read from `events` by the
   * `versionNo` in the payload (versioning door 3). A view is listed once per version, as the first one. The same read
   * feeds the agreement's activity timeline, which takes every event of the ten types it lists (activity-timeline).
   */
  async function versionHistory(row: AgreementRow, versions: VersionRow[]) {
    const { data: eventRows, error } = await client
      .from("events")
      .select("type, payload, actor_id, created_at")
      .eq("entity_type", "agreement")
      .eq("entity_id", row.id)
      .in("type", TIMELINE_EVENT_TYPES)
      .order("created_at", { ascending: true });
    if (error) throw new Error(`Supabase error ${error.code}: ${error.message}`);
    const events = Array.isArray(eventRows) ? (eventRows as EventRow[]) : [];

    const userIds = [...new Set([...versions.map((v) => v.created_by), ...events.map((e) => e.actor_id)].filter((id): id is string => id !== null))];
    const roles = new Map<string, MemberRole>();
    if (userIds.length > 0) {
      const { data: members, error: membersError } = await client.from("memberships").select("user_id, role").eq("org_id", row.org_id).in("user_id", userIds);
      if (membersError) throw new Error(`Supabase error ${membersError.code}: ${membersError.message}`);
      for (const member of (members ?? []) as { user_id: string; role: string }[]) roles.set(member.user_id, member.role as MemberRole);
    }

    const byVersion = new Map<number, VersionEvent[]>();
    let sentVersion: number | null = null;
    let acceptedVersion: number | null = null;
    for (const event of events) {
      const type = EVENT_KINDS[event.type];
      const versionNo = versionOfEvent(event, versions);
      if (!type || versionNo === null) continue;
      if (type === "sent") sentVersion = versionNo;
      if (type === "accepted") acceptedVersion = versionNo;
      const listed = byVersion.get(versionNo) ?? [];
      if (type === "viewed" && listed.some((e) => e.type === "viewed")) continue;
      const by = event.actor_id === null || event.payload?.via === "portal" ? "customer" : (roles.get(event.actor_id) ?? null);
      listed.push({ type, at: new Date(event.created_at), by });
      byVersion.set(versionNo, listed);
    }

    const views: VersionView[] = versions.map((version) => ({
      versionNo: version.version_no,
      createdAt: new Date(version.created_at),
      reason: version.reason ?? null,
      author: !version.created_by ? null : (roles.get(version.created_by) ?? null),
      events: byVersion.get(version.version_no) ?? [],
    }));
    const sources: TimelineSource[] = events.map((event) => ({
      type: event.type,
      at: new Date(event.created_at),
      versionNo: versionOfEvent(event, versions),
      hasActor: event.actor_id !== null,
      actorRole: event.actor_id === null ? null : (roles.get(event.actor_id) ?? null),
      payload: event.payload ?? {},
    }));
    const first = versions.find((version) => version.version_no === 1);
    const created = first ? { at: new Date(first.created_at), authorRole: first.created_by ? (roles.get(first.created_by) ?? null) : null } : null;
    return {
      versions: views,
      sentVersion,
      acceptedVersion,
      timeline: (renews: { id: string; number: string } | null) => buildTimeline({ events: sources, created, renews }),
    };
  }

  /**
   * The types a line of the editable version can cover: those with an asset on the site, plus those its lines already
   * cover, by name (cadence AC 8).
   */
  async function equipmentChoices(siteId: string, covered: string[]): Promise<EquipmentChoice[]> {
    const { data: assets, error } = await client.from("assets").select("asset_type_id").eq("site_id", siteId);
    if (error) throw new Error(`Supabase error ${error.code}: ${error.message}`);
    const ids = [...new Set([...(assets ?? []).map((asset) => asset.asset_type_id), ...covered])];
    if (ids.length === 0) return [];
    const { data: types, error: typesError } = await client
      .from("asset_types")
      .select("id, code, name, default_visit_months")
      .in("id", ids)
      .order("name", { ascending: true });
    if (typesError) throw new Error(`Supabase error ${typesError.code}: ${typesError.message}`);
    return (types ?? [])
      .map((type) => ({ id: type.id, code: type.code, name: type.name, defaultVisitMonths: [...type.default_visit_months] }))
      .sort(byName);
  }

  /** The agreement this one renews, and the one that renews it (renewal door 1); each row is checked against the id asked for. */
  async function renewalLinks(id: string, renewsId: string | null) {
    const link = async (column: "id" | "renews_agreement_id", value: string) => {
      const { data, error } = await client.from("agreements").select("id, number, renews_agreement_id").eq(column, value).maybeSingle();
      if (error) throw new Error(`Supabase error ${error.code}: ${error.message}`);
      const row = data as LinkRow | null;
      return row && row[column] === value ? { id: row.id, number: row.number ?? "" } : null;
    };
    return {
      renews: renewsId ? await link("id", renewsId) : null,
      renewedBy: await link("renews_agreement_id", id),
    };
  }

  /** Who would sign, by the one rule the database keeps (`contract_signer`, door 6); `null` when nobody has an email. */
  async function contractSigner(siteId: string): Promise<{ name: string; email: string } | null> {
    const { data, error } = await client.rpc("contract_signer", { p_site_id: siteId });
    if (error) throw new Error(`Supabase error ${error.code}: ${error.message}`);
    const signer = data as { name?: unknown; email?: unknown } | null;
    return signer && typeof signer.name === "string" && typeof signer.email === "string" ? { name: signer.name, email: signer.email } : null;
  }

  return {
    async get(id, versionNo, compareNo) {
      if (!isUuid(id)) return null;
      const { data, error } = await client
        .from("agreements")
        .select("id, org_id, number, status, renews_agreement_id, sites(id, name, customers(id, name)), agreement_versions(id, version_no, created_at, term_start, term_months, term_end, valid_until, created_by, reason, template_version_id, document_template_versions(body), contracts(id, status))")
        .eq("id", id)
        .maybeSingle();
      if (error) throw new Error(`Supabase error ${error.code}: ${error.message}`);
      if (!data) return null;

      const row = data as unknown as AgreementRow;
      const versions = [...row.agreement_versions].sort((a, b) => b.version_no - a.version_no);
      const latest = versions[0];
      const shownVersion = versions.find((version) => version.version_no === versionNo) ?? latest;

      const lines = shownVersion ? await linesOf(shownVersion.id) : [];
      const compared = compareNo !== undefined && compareNo !== shownVersion?.version_no ? versions.find((version) => version.version_no === compareNo) : undefined;
      const compareLines = compared ? await linesOf(compared.id) : [];
      const history = await versionHistory(row, versions);

      const status = row.status as AgreementStatus;
      const current = shownVersion !== undefined && shownVersion === latest;
      const editable = status === "draft" && current;
      const { serviceScope, terms } = await recorded(row.sites.id, shownVersion?.id, editable);
      const links = await renewalLinks(row.id, row.renews_agreement_id ?? null);
      const contract = latest?.contracts[0]?.id ? { id: latest.contracts[0].id, status: latest.contracts[0].status as ContractStatus } : null;
      // Only a writer about to generate a contract needs the signer, and only for an accepted agreement that has none (door 6).
      const signer = status === "accepted" && contract === null ? await contractSigner(row.sites.id) : null;
      return {
        id: row.id,
        number: row.number ?? "",
        status,
        stage: pipelineStage(status, latest?.contracts[0]?.status as ContractStatus | undefined),
        site: { id: row.sites.id, name: row.sites.name },
        customer: { id: row.sites.customers.id, name: row.sites.customers.name },
        versions: history.versions,
        sentVersion: history.sentVersion,
        acceptedVersion: history.acceptedVersion,
        timeline: history.timeline(links.renews),
        compare: compared ? { versionNo: compared.version_no, lines: compareLines, annualCents: sumCents(compareLines.map((line) => cents(line.annualCents))) } : null,
        shown: {
          versionNo: shownVersion?.version_no ?? 1,
          current,
          lines,
          annualCents: sumCents(lines.map((line) => cents(line.annualCents))),
        },
        editable,
        equipmentChoices: editable ? await equipmentChoices(row.sites.id, lines.flatMap((line) => line.equipment.map((type) => type.id))) : [],
        serviceScope,
        terms,
        term: { start: shownVersion?.term_start ?? null, months: shownVersion?.term_months ?? 12, end: shownVersion?.term_end ?? null },
        validUntil: shownVersion?.valid_until ?? null,
        template: templateOf(shownVersion),
        portalLink: await portalLink(shownVersion?.id, status, current),
        linkEmail: await linkEmail(row.id, status, current),
        ...links,
        contract,
        signer,
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
        if (error.code === "55000" && error.hint === "plan_limit_agreements") {
          // The detail is `<plan>|<limit>|<used>` (plan-limits door 1); a detail that does not read that way is not a limit we can name.
          const [plan, limit, used] = (error.details ?? "").split("|");
          if (plan && /^\d+$/.test(limit ?? "") && /^\d+$/.test(used ?? "")) return { ok: false, code: "plan_limit", plan, limit: Number(limit), used: Number(used) };
        }
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

/** SQLSTATEs `save_service_line` raises on purpose (cadence door 4); anything else is unavailable. */
const LINE_FAILURES: Record<string, "locked" | "forbidden" | "not_found" | "too_many"> = {
  [FROZEN]: "locked",
  "42501": "forbidden",
  P0002: "not_found",
  "23503": "not_found",
  "54000": "too_many",
};

export function supabaseServiceLineStore(client: Client): ServiceLineStore {
  /** One line's write as the member; RLS hides other orgs' lines, so no row back is `not_found`. */
  async function written(what: string, query: PromiseLike<{ data: { id: string }[] | null; error: PostgrestError | null }>): Promise<ServiceLineWriteResult> {
    const { data, error } = await query;
    if (error) return failure(what, error);
    return (data ?? []).length > 0 ? { ok: true } : { ok: false, code: "not_found" };
  }

  /** The line and its coverage in one transaction (cadence door 4); a null line id adds one. */
  async function save(what: string, agreementId: string, lineId: string | null, value: ServiceLineValue) {
    const { data, error } = await client.rpc("save_service_line", {
      p_agreement_id: agreementId,
      p_line_id: lineId as string,
      p_description: value.description,
      p_visit_months: value.visitMonths,
      p_cost_per_visit_cents: value.costPerVisitCents,
      p_asset_type_ids: value.assetTypeIds,
    });
    if (!error) return { ok: true as const, id: data };
    const code = LINE_FAILURES[error.code];
    // Only an add can find the version full; on a save of a line, 54000 is as unexpected as any other code.
    if (code === "too_many" && lineId !== null) return unavailable(what, `${error.code} ${error.message}`);
    return code ? { ok: false as const, code } : unavailable(what, `${error.code} ${error.message}`);
  }

  return {
    async add(agreementId, value) {
      try {
        const saved = await save("Adding a service line", agreementId, null, value);
        if (!saved.ok) return saved;
        return saved.id ? { ok: true, id: saved.id } : unavailable("Adding a service line", "save_service_line returned no id");
      } catch (cause) {
        return unavailable("Adding a service line", cause);
      }
    },

    async update(lineId, value) {
      try {
        // The RPC takes the agreement; the line names it through its version. RLS hides other orgs' lines.
        const { data: line, error } = await client.from("service_lines").select("agreement_versions(agreement_id)").eq("id", lineId).maybeSingle();
        if (error) return failure("Saving a service line", error);
        const agreementId = (line as { agreement_versions: { agreement_id: string } | null } | null)?.agreement_versions?.agreement_id;
        if (!agreementId) return { ok: false, code: "not_found" };
        const saved = await save("Saving a service line", agreementId, lineId, value);
        if (saved.ok) return { ok: true };
        return saved.code === "too_many" ? unavailable("Saving a service line", "54000 on a saved line") : { ok: false, code: saved.code };
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

const TERM_FAILURES: Record<string, "locked" | "forbidden" | "not_found" | "invalid"> = {
  [FROZEN]: "locked",
  "42501": "forbidden",
  P0002: "not_found",
  "23514": "invalid",
};

/** The term of the current version of a draft, through `save_agreement_term` only (term-dates door 3). */
export function supabaseAgreementTermStore(client: Client): AgreementTermStore {
  return {
    async save(agreementId, term) {
      try {
        const { error } = await client.rpc("save_agreement_term", {
          p_agreement_id: agreementId,
          p_term_start: term.start,
          p_term_months: term.months,
        });
        if (!error) return { ok: true };
        const code = TERM_FAILURES[error.code];
        return code ? { ok: false, code } : failure("Saving the term", error);
      } catch (cause) {
        return unavailable("Saving the term", cause);
      }
    },
  };
}

/** The staff note of the current version of a draft, through `save_version_note` only (versioning door 1). */
export function supabaseVersionNoteStore(client: Client): VersionNoteStore {
  return {
    async save(agreementId, note) {
      try {
        const { error } = await client.rpc("save_version_note", { p_agreement_id: agreementId, p_note: note });
        if (!error) return { ok: true };
        const code = TERM_FAILURES[error.code];
        return code ? { ok: false, code } : failure("Saving the version note", error);
      } catch (cause) {
        return unavailable("Saving the version note", cause);
      }
    },
  };
}
