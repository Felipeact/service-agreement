import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";

const count = (doc: ProseMirrorNode, key: string) => {
  let found = 0;
  doc.forEach((child) => {
    if (child.type.name === "section" && child.attrs.key === key) found += 1;
  });
  return found;
};

/**
 * Keeps a section the document cannot do without on the page: an edit that would remove the last one (Backspace, cut, a delete over a
 * selection) is refused, so a contract never loses the signatures the signing service needs.
 */
export const KeepSection = Extension.create<{ keys: string[] }>({
  name: "keepSection",
  addOptions: () => ({ keys: [] }),
  addProseMirrorPlugins() {
    const keys = this.options.keys;
    return [
      new Plugin({
        key: new PluginKey("keepSection"),
        filterTransaction: (transaction, state) => {
          if (!transaction.docChanged || keys.length === 0) return true;
          return keys.every((key) => count(state.doc, key) === 0 || count(transaction.doc, key) > 0);
        },
      }),
    ];
  },
});
