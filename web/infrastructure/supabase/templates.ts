import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { validateAgreementTemplate, type AgreementTemplateBody } from "@/domain/agreement";
import type { AgreementTemplateReader, AgreementTemplateStore, TemplateFailure } from "@/application/ports";
import type { Database, Json } from "./database.types";

type Client = SupabaseClient<Database>;

const ROW_CAP = 500;

/** SQLSTATEs `save_agreement_template` and `archive_agreement_template` raise on purpose (agreement-templates door 4). */
const FAILURES: Record<string, TemplateFailure> = {
  "42501": "forbidden",
  "22023": "invalid",
  "23505": "name_taken",
  P0002: "not_found",
};

function failure(what: string, error: Pick<PostgrestError, "code" | "message">): { ok: false; code: TemplateFailure } {
  const code = FAILURES[error.code];
  if (code) return { ok: false, code };
  console.error(`${what} failed: ${error.code} ${error.message}`);
  return { ok: false, code: "unavailable" };
}

function unavailable(what: string, cause: unknown): { ok: false; code: "unavailable" } {
  console.error(`${what} failed: ${cause instanceof Error ? cause.message : String(cause)}`);
  return { ok: false, code: "unavailable" };
}

/** The non-archived agreement templates the member can read (RLS: the org's own and the system one), each with its latest version. */
export function supabaseAgreementTemplateReader(client: Client): AgreementTemplateReader {
  return {
    async list() {
      try {
        const { data, error } = await client
          .from("document_templates")
          .select("id, org_id, document_template_versions(id, version_no, body, created_at)")
          .eq("kind", "agreement")
          .is("archived_at", null)
          .order("version_no", { referencedTable: "document_template_versions", ascending: false })
          .limit(1, { referencedTable: "document_template_versions" })
          .limit(ROW_CAP);
        if (error) return unavailable("Listing agreement templates", `${error.code} ${error.message}`);

        const templates = [];
        for (const row of data) {
          const latest = row.document_template_versions[0];
          if (!latest) continue;
          const checked = validateAgreementTemplate(latest.body);
          if (!checked.ok) return unavailable("Listing agreement templates", `template ${row.id} has no readable body: ${checked.reason}`);
          templates.push({
            id: row.id,
            versionId: latest.id,
            versionNo: latest.version_no,
            updatedAt: new Date(latest.created_at),
            system: row.org_id === null,
            body: checked.body,
          });
        }
        templates.sort((a, b) => a.body.name.localeCompare(b.body.name, "en", { sensitivity: "base" }));
        return { ok: true, templates };
      } catch (cause) {
        return unavailable("Listing agreement templates", cause);
      }
    },
  };
}

/** Writes through the two definer functions, as the member: the database decides who may and what a body may hold. */
export function supabaseAgreementTemplateStore(client: Client): AgreementTemplateStore {
  return {
    async save(templateId, body: AgreementTemplateBody) {
      try {
        const { data, error } = await client.rpc("save_agreement_template", { p_template_id: templateId, p_body: body as unknown as Json });
        if (error) return failure("Saving an agreement template", error);
        const saved = data?.[0];
        if (!saved) return unavailable("Saving an agreement template", "no row came back");
        return { ok: true, templateId: saved.template_id, versionNo: saved.version_no };
      } catch (cause) {
        return unavailable("Saving an agreement template", cause);
      }
    },

    async archive(templateId) {
      try {
        const { error } = await client.rpc("archive_agreement_template", { p_template_id: templateId });
        if (error) return failure("Archiving an agreement template", error);
        return { ok: true };
      } catch (cause) {
        return unavailable("Archiving an agreement template", cause);
      }
    },
  };
}
