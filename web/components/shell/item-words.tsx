"use client";

import { createContext, useContext, type ReactNode } from "react";
import { DEFAULT_ITEM_WORDS, itemText, type ItemWords } from "@/domain/org-settings";

const ItemWordsContext = createContext<ItemWords>(DEFAULT_ITEM_WORDS);

/** Gives the client components under the shell the org's item words (item-vocabulary AC 5); the default outside it. */
export function ItemWordsProvider({ words, children }: { words: ItemWords; children: ReactNode }) {
  return <ItemWordsContext.Provider value={words}>{children}</ItemWordsContext.Provider>;
}

export const useItemWords = () => useContext(ItemWordsContext);

/** Copy written for the default word, spoken in the org's: for server components, which cannot call `useItemWords`. */
export function ItemText({ children }: { children: string }) {
  return <>{itemText(children, useItemWords())}</>;
}
