import { normalized } from "@/domain/imports";
import type { AssetTypeCatalog, TypeSuggester } from "@/application/ports";

/** A suggested type for one unrecognised spelling: `key` is the spelling as the review groups it (`normalized`). */
export type TypeSuggestionForReview = { key: string; typeId: string; confidence: "low" | "medium" | "high" };

export type SuggestImportTypesResult = { ok: true; suggestions: TypeSuggestionForReview[] } | { ok: false; code: "unavailable" };

/**
 * Asks the model which of the org's types each unrecognised spelling means. Only the spellings and the org's type names and codes
 * leave: no file, no row, no unit. An answer is kept only when it names a code the org has, for a spelling that was asked about,
 * so a made-up code or an extra entry is dropped; "no type fits" is left out too. Nothing is saved: the person applies them.
 */
export function makeSuggestImportTypes(catalog: AssetTypeCatalog, suggester: TypeSuggester) {
  return async function suggestImportTypes(spellings: { key: string; raw: string }[]): Promise<SuggestImportTypesResult> {
    if (spellings.length === 0) return { ok: true, suggestions: [] };
    let types: Awaited<ReturnType<AssetTypeCatalog["list"]>>;
    let tradeContext: string | null;
    try {
      [types, tradeContext] = await Promise.all([catalog.list(), catalog.tradeContext()]);
    } catch (cause) {
      console.error(`Reading the types to suggest from failed: ${cause instanceof Error ? cause.message : String(cause)}`);
      return { ok: false, code: "unavailable" };
    }
    const answered = await suggester.suggest(
      spellings.map((spelling) => spelling.raw),
      types.map(({ code, name }) => ({ code, name })),
      tradeContext,
    );
    if (!answered.ok) return answered;

    const byCode = new Map(types.map((type) => [type.code, type.id]));
    const suggestions: TypeSuggestionForReview[] = [];
    for (const spelling of spellings) {
      const found = answered.suggestions.find((candidate) => normalized(candidate.spelling) === spelling.key);
      const typeId = found?.typeCode ? byCode.get(found.typeCode) : undefined;
      if (found && typeId) suggestions.push({ key: spelling.key, typeId, confidence: found.confidence });
    }
    return { ok: true, suggestions };
  };
}
