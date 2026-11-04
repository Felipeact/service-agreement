import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import type {
  AssetStore,
  ContactStore,
  CreateResult,
  CustomerStore,
  DeleteResult,
  SetActiveResult,
  SiteStore,
  WriteFailure,
  WriteResult,
} from "@/application/ports";
import type { AssetValue, ContactValue, CustomerValue, SiteValue } from "@/domain/records";
import type { Database } from "./database.types";

type Client = SupabaseClient<Database>;
type Kind = "create" | "update" | "delete";
type Outcome = { ok: true; id: string } | { ok: false; code: WriteFailure | "in_use" };

/**
 * Runs one insert, update or delete that selects `id` back, and maps the result (door 2). RLS hides rows the member
 * cannot change, so an update or delete returning nothing is `not_found`; a composite FK refusal (`23503`) means a
 * missing or foreign parent on a write, and a row still referenced on a delete.
 */
async function write(what: string, kind: Kind, run: () => PromiseLike<{ data: { id: string }[] | null; error: PostgrestError | null }>): Promise<Outcome> {
  try {
    const { data, error } = await run();
    if (error) {
      if (error.code === "42501") return { ok: false, code: "forbidden" };
      if (error.code === "23503") return { ok: false, code: kind === "delete" ? "in_use" : "not_found" };
      console.error(`${what} failed: ${error.code} ${error.message}`);
      return { ok: false, code: "unavailable" };
    }
    const [row] = data ?? [];
    return row ? { ok: true, id: row.id } : { ok: false, code: "not_found" };
  } catch (cause) {
    console.error(`${what} failed: ${cause instanceof Error ? cause.message : String(cause)}`);
    return { ok: false, code: "unavailable" };
  }
}

// Only a delete can be `in_use`, so a create or update outcome narrows safely.
const created = (outcome: Outcome) => outcome as CreateResult;
const updated = (outcome: Outcome): WriteResult => (outcome.ok ? { ok: true } : (outcome as WriteResult));
const deleted = (outcome: Outcome): DeleteResult => (outcome.ok ? { ok: true } : outcome);

type RpcCall = () => PromiseLike<{ error: PostgrestError | null }>;

function detailOf(error: PostgrestError): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(error.details ?? "");
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

const textOf = (value: unknown) => (typeof value === "string" ? value : "");

/**
 * Runs one `set_*_active` call (deactivation door 3) and maps its refusals: `55000` by its hint (the detail names the
 * blocking site, agreement or parent), `23514` an invalid replacement, `42501` forbidden, `P0002` not found.
 */
async function setActive(what: string, run: RpcCall): Promise<SetActiveResult> {
  try {
    const { error } = await run();
    if (!error) return { ok: true };
    if (error.code === "55000") {
      const detail = detailOf(error);
      if (error.hint === "in_term") {
        const termEnd = textOf(detail.termEnd);
        return { ok: false, code: "in_term", site: textOf(detail.site), number: textOf(detail.number), termEnd: termEnd || null };
      }
      if (error.hint === "changes_requested") return { ok: false, code: "changes_requested", site: textOf(detail.site), number: textOf(detail.number) };
      if (error.hint === "customer_inactive" || error.hint === "site_inactive") {
        return { ok: false, code: "parent_inactive", parent: textOf(detail.customer ?? detail.site) };
      }
    }
    if (error.code === "23514") return { ok: false, code: "invalid_replacement" };
    if (error.code === "42501") return { ok: false, code: "forbidden" };
    if (error.code === "P0002") return { ok: false, code: "not_found" };
    console.error(`${what} failed: ${error.code} ${error.message}`);
    return { ok: false, code: "unavailable" };
  } catch (cause) {
    console.error(`${what} failed: ${cause instanceof Error ? cause.message : String(cause)}`);
    return { ok: false, code: "unavailable" };
  }
}

const contactRow = (value: ContactValue) => ({ name: value.name, email: value.email, phone: value.phone });
const siteRow = (value: SiteValue) => ({
  name: value.name,
  address: value.address,
  site_contact_id: value.siteContactId,
  ...(value.approverContactId !== undefined && { approver_contact_id: value.approverContactId }),
});
const customerRow = (value: CustomerValue) => ({
  name: value.name,
  ...(value.billingContactId !== undefined && { billing_contact_id: value.billingContactId }),
});
const assetRow = (value: AssetValue) => ({
  asset_type_id: value.assetTypeId,
  unit_no: value.unitNo,
  type_model: value.typeModel,
  location: value.location,
});

export function supabaseCustomerStore(client: Client): CustomerStore {
  return {
    async create(orgId, value) {
      return created(await write("Creating a customer", "create", () => client.from("customers").insert({ org_id: orgId, name: value.name }).select("id")));
    },
    async update(id, value) {
      return updated(await write("Updating a customer", "update", () => client.from("customers").update(customerRow(value)).eq("id", id).select("id")));
    },
    async setActive(id, active) {
      return setActive("Changing a customer's status", () => client.rpc("set_customer_active", { p_customer_id: id, p_active: active }));
    },
  };
}

export function supabaseContactStore(client: Client): ContactStore {
  return {
    async create(orgId, customerId, value) {
      return created(
        await write("Creating a contact", "create", () =>
          client.from("contacts").insert({ org_id: orgId, customer_id: customerId, ...contactRow(value) }).select("id"),
        ),
      );
    },
    async update(id, value) {
      return updated(await write("Updating a contact", "update", () => client.from("contacts").update(contactRow(value)).eq("id", id).select("id")));
    },
    async delete(id) {
      return deleted(await write("Deleting a contact", "delete", () => client.from("contacts").delete().eq("id", id).select("id")));
    },
  };
}

export function supabaseSiteStore(client: Client): SiteStore {
  return {
    async create(orgId, customerId, value) {
      return created(
        await write("Creating a site", "create", () =>
          client.from("sites").insert({ org_id: orgId, customer_id: customerId, ...siteRow(value) }).select("id"),
        ),
      );
    },
    async update(id, value) {
      return updated(await write("Updating a site", "update", () => client.from("sites").update(siteRow(value)).eq("id", id).select("id")));
    },
    async setActive(id, active) {
      return setActive("Changing a site's status", () => client.rpc("set_site_active", { p_site_id: id, p_active: active }));
    },
  };
}

export function supabaseAssetStore(client: Client): AssetStore {
  return {
    async create(orgId, siteId, value) {
      return created(
        await write("Creating an asset", "create", () =>
          client.from("assets").insert({ org_id: orgId, site_id: siteId, ...assetRow(value), source: "manual" }).select("id"),
        ),
      );
    },
    async update(id, value) {
      return updated(await write("Updating an asset", "update", () => client.from("assets").update(assetRow(value)).eq("id", id).select("id")));
    },
    async setActive(id, active, replacedBy = null) {
      return setActive("Changing an asset's status", () =>
        client.rpc("set_asset_active", { p_asset_id: id, p_active: active, p_replaced_by: replacedBy as string }),
      );
    },
  };
}
