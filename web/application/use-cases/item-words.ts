import type { OrgSettings } from "@/application/ports";
import { DEFAULT_ITEM_WORDS, itemWords, type ItemWords } from "@/domain/org-settings";

/** The org's item words for the screens that name the item; the defaults for an org with no settings row (item-vocabulary AC 4). */
export function itemWordsReader(get: (orgId: string) => Promise<Pick<OrgSettings, "itemSingular" | "itemPlural"> | null>) {
  return async (orgId: string): Promise<ItemWords> => {
    const found = await get(orgId);
    return found ? itemWords(found.itemSingular, found.itemPlural) : DEFAULT_ITEM_WORDS;
  };
}
