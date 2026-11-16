/** One asset of a covered type on a draft: left in or out of the agreement's scope. Never stored in a snapshot (p0-launch-fixes door 1). */
export type ScopeControl = {
  assetId: string;
  typeCode: string;
  typeName: string;
  unitNo: string | null;
  typeModel: string | null;
  location: string | null;
  excluded: boolean;
};

/** An equipment type on the site that no service line covers, so the agreement does not promise it. */
export type UncoveredType = { code: string; name: string; assetCount: number };

export type ScopeDraft = { controls: ScopeControl[]; uncovered: UncoveredType[] };

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown): string | null => (typeof value === "string" ? value : null);

/**
 * The draft-only keys of `agreement_service_scope`: `controls` and `uncovered`. Anything malformed is dropped, so a bad
 * row shows less rather than breaking the page.
 */
export function parseScopeDraft(document: unknown): ScopeDraft {
  const read = (key: string): unknown[] => (isRecord(document) && Array.isArray(document[key]) ? (document[key] as unknown[]) : []);
  const controls = read("controls").flatMap((row): ScopeControl[] => {
    if (!isRecord(row)) return [];
    const assetId = text(row.assetId);
    const typeCode = text(row.typeCode);
    const typeName = text(row.typeName);
    if (assetId === null || typeCode === null || typeName === null || typeof row.excluded !== "boolean") return [];
    return [{ assetId, typeCode, typeName, unitNo: text(row.unitNo), typeModel: text(row.typeModel), location: text(row.location), excluded: row.excluded }];
  });
  const uncovered = read("uncovered").flatMap((row): UncoveredType[] => {
    if (!isRecord(row)) return [];
    const code = text(row.code);
    const name = text(row.name);
    if (code === null || name === null || typeof row.assetCount !== "number") return [];
    return [{ code, name, assetCount: row.assetCount }];
  });
  return { controls, uncovered };
}
