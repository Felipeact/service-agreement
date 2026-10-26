import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import type {
  AssetStore,
  ContactStore,
  CreateResult,
  CustomerStore,
  DeleteResult,
  SiteStore,
  WriteFailure,
  WriteResult,
} from "@/application/ports";
import type { AssetValue, ContactValue, SiteValue } from "@/domain/records";
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

const contactRow = (value: ContactValue) => ({ name: value.name, email: value.email, phone: value.phone });
const siteRow = (value: SiteValue) => ({ name: value.name, address: value.address, site_contact_id: value.siteContactId });
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
      return updated(await write("Updating a customer", "update", () => client.from("customers").update({ name: value.name }).eq("id", id).select("id")));
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
    async delete(id) {
      return deleted(await write("Deleting an asset", "delete", () => client.from("assets").delete().eq("id", id).select("id")));
    },
  };
}
