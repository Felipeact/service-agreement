import type { AssetView } from "@/application/ports";

export type AssetGroup = { code: string; name: string; heading: string; count: number; rows: AssetView[] };

const compare = (a: string, b: string) => a.localeCompare(b, "en", { numeric: true, sensitivity: "base" });

/** Keeps the assets whose unit, type/model, location or type name contains `query`, ignoring case. */
export function filterAssets(assets: AssetView[], query: string): AssetView[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return assets;
  return assets.filter((asset) =>
    [asset.unitNo, asset.typeModel, asset.location, asset.typeName].some((field) => (field ?? "").toLowerCase().includes(needle)),
  );
}

/** Groups by asset type (ordered by type name); rows by unit, numbers compared as numbers, no unit last. */
export function groupAssets(assets: AssetView[]): AssetGroup[] {
  const groups = new Map<string, AssetGroup>();
  for (const asset of assets) {
    const group = groups.get(asset.typeCode) ?? {
      code: asset.typeCode,
      name: asset.typeName,
      heading: `${asset.typeCode} - ${asset.typeName}`,
      count: 0,
      rows: [],
    };
    group.rows.push(asset);
    group.count = group.rows.length;
    groups.set(asset.typeCode, group);
  }
  for (const group of groups.values()) {
    group.rows.sort((a, b) => {
      if (a.unitNo === null || b.unitNo === null) return a.unitNo === b.unitNo ? 0 : a.unitNo === null ? 1 : -1;
      return compare(a.unitNo, b.unitNo);
    });
  }
  return [...groups.values()].sort((a, b) => compare(a.name, b.name));
}
