import type { AssetTypeCatalog, EquipmentTypeCreator, EquipmentTypeRef, TypeSuggester } from "@/application/ports";
import { FALLBACK_TYPE_NAME, matchAssetType, normalized, proposedTypeName } from "@/domain/imports";

/** The org type a spelling resolved to, and whether this call made it. */
export type ResolvedType = { typeId: string; code: string; name: string; created: boolean };

export type ResolveTypesResult = {
  /** By the spelling as `normalized` writes it. The empty spelling resolves to the fallback type "Other equipment". */
  byKey: Map<string, ResolvedType>;
  /** Spellings that could not be given a type at all (the catalog could not be read, or the member may not add types). */
  failed: string[];
};

/**
 * Gives every equipment wording a type of the org's, so a list never has to stop at "needs a type" (shared by the New agreement
 * upload, Ask AI and the MCP and API equipment tools). In order: the catalog's own match (names, codes, the org's spellings); then
 * the model's pick among the catalog's types; then a NEW type: the model's proposal when it gave one, else the spelling tidied. A new
 * type is added through `EquipmentTypeCreator`, which reuses a type of the same name. When the model is unavailable nothing is lost:
 * the tidied spelling becomes the type. Only the wordings and the catalog's names leave: no customer, site, unit or file.
 */
export function makeResolveEquipmentTypes(deps: { catalog: AssetTypeCatalog; suggester: TypeSuggester; creator: EquipmentTypeCreator }) {
  const { catalog, suggester, creator } = deps;

  return async function resolveEquipmentTypes(orgId: string, spellings: (string | null)[]): Promise<ResolveTypesResult> {
    const byKey = new Map<string, ResolvedType>();
    const failed: string[] = [];
    const wanted = new Map<string, string>();
    for (const raw of spellings) {
      const key = normalized(raw ?? "");
      if (!wanted.has(key)) wanted.set(key, (raw ?? "").trim());
    }
    let types: Awaited<ReturnType<AssetTypeCatalog["list"]>>;
    let tradeContext: string | null = null;
    try {
      [types, tradeContext] = await Promise.all([catalog.list(), catalog.tradeContext().catch(() => null)]);
    } catch (cause) {
      console.error(`Reading the catalog to resolve types failed: ${cause instanceof Error ? cause.message : String(cause)}`);
      return { byKey, failed: [...wanted.values()] };
    }
    const byId = new Map(types.map((type) => [type.id, type]));

    const rest: { key: string; raw: string }[] = [];
    for (const [key, raw] of wanted) {
      const id = key === "" ? null : matchAssetType(raw, types);
      const found = id ? byId.get(id) : undefined;
      if (found) byKey.set(key, { typeId: found.id, code: found.code, name: found.name, created: false });
      else rest.push({ key, raw });
    }

    // The model's pick, or its proposal for a type to add. A failed call only means every spelling falls through to its tidied self.
    const answer = rest.some((item) => item.key !== "") ? await suggester.suggest(rest.filter((item) => item.key !== "").map((item) => item.raw), types.map(({ code, name }) => ({ code, name })), tradeContext) : null;
    const answers = new Map((answer?.ok ? answer.suggestions : []).map((suggestion) => [normalized(suggestion.spelling), suggestion]));
    const byCode = new Map(types.map((type) => [type.code, type]));

    const proposals = new Map<string, { name: string; months: number[]; keys: string[] }>();
    for (const { key, raw } of rest) {
      const suggestion = answers.get(key);
      const picked = suggestion?.typeCode ? byCode.get(suggestion.typeCode) : undefined;
      if (picked) {
        byKey.set(key, { typeId: picked.id, code: picked.code, name: picked.name, created: false });
        continue;
      }
      const name = key === "" ? FALLBACK_TYPE_NAME : (suggestion?.newType?.name.trim() || proposedTypeName(raw));
      if (!name) {
        failed.push(raw);
        continue;
      }
      const lower = name.toLowerCase();
      const existing = proposals.get(lower);
      if (existing) existing.keys.push(key);
      else proposals.set(lower, { name, months: suggestion?.newType?.months ?? [], keys: [key] });
    }

    for (const proposal of proposals.values()) {
      const made: Awaited<ReturnType<EquipmentTypeCreator["create"]>> = await creator.create(orgId, proposal.name, proposal.months).catch(() => ({ ok: false, code: "unavailable" }) as const);
      if (!made.ok) {
        failed.push(...proposal.keys.map((key) => wanted.get(key) ?? proposal.name));
        continue;
      }
      const type: EquipmentTypeRef = made.type;
      for (const key of proposal.keys) byKey.set(key, { typeId: type.id, code: type.code, name: type.name, created: type.created });
    }
    return { byKey, failed };
  };
}

export type ResolveEquipmentTypes = ReturnType<typeof makeResolveEquipmentTypes>;
