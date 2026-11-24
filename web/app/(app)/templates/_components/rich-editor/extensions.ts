import { Extension, Node, mergeAttributes, type AnyExtension } from "@tiptap/core";
import { NodeSelection, type EditorState } from "@tiptap/pm/state";
import { ReactNodeViewRenderer } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Color, TextStyle } from "@tiptap/extension-text-style";
import Highlight from "@tiptap/extension-highlight";
import TextAlign from "@tiptap/extension-text-align";
import { Table, TableCell, TableHeader, TableRow } from "@tiptap/extension-table";
import { Placeholder } from "@tiptap/extensions";
import { VARIABLE_LABELS } from "@/domain/templates/editor-model";
import { toFontFamily, toFontSize, toHex, type FontFamily } from "@/domain/rich-document";
import { ImageView } from "./image-view";
import { LogoView } from "./logo-view";
import { SectionView } from "./section-view";
import { VariableView } from "./variable-view";

/**
 * The editor's schema (rich-templates): exactly the nodes, marks and attributes `validateRichDoc` accepts, so what the editor makes is
 * what the server stores. Anything pasted that the schema has no place for is dropped by ProseMirror's parser; what it keeps is
 * normalized again before saving.
 */

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    richBlocks: {
      /** Sets the indent of the paragraphs and headings in the selection: 0 to 3 steps. */
      indentBy: (by: 1 | -1) => ReturnType;
      /** Inserts a merge field at the cursor. */
      insertField: (name: string) => ReturnType;
      /** Inserts a live section after the block the cursor is in. */
      insertSection: (key: string) => ReturnType;
      insertPageBreak: () => ReturnType;
      insertCompanyLogo: () => ReturnType;
      insertPicture: (asset: string) => ReturnType;
    };
  }
}

/** Sizes as points on the page: the editor draws `calc(<n> * var(--pt))`, so the page looks as the PDF prints it at any width. */
const FontStyle = Extension.create({
  name: "fontStyle",
  addGlobalAttributes() {
    return [
      {
        types: ["textStyle"],
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element) => toFontSize(element.dataset.size ?? element.style.fontSize),
            renderHTML: (attributes) => (attributes.fontSize ? { "data-size": attributes.fontSize, style: `font-size: calc(${Number.parseInt(attributes.fontSize, 10)} * var(--pt))` } : {}),
          },
          fontFamily: {
            default: null,
            parseHTML: (element) => toFontFamily(element.style.fontFamily),
            renderHTML: (attributes) => (attributes.fontFamily ? { style: `font-family: ${attributes.fontFamily as FontFamily}` } : {}),
          },
        },
      },
    ];
  },
});

/** Indent (0 to 3 steps) on paragraphs and headings, and "hide when a field is empty" on paragraphs. */
const BlockSettings = Extension.create({
  name: "blockSettings",
  addGlobalAttributes() {
    return [
      {
        types: ["paragraph", "heading"],
        attributes: {
          indent: {
            default: 0,
            parseHTML: (element) => Math.min(3, Math.max(0, Number(element.dataset.indent) || 0)),
            renderHTML: (attributes) => (attributes.indent ? { "data-indent": attributes.indent } : {}),
          },
        },
      },
      {
        types: ["paragraph"],
        attributes: {
          omitIfMissing: {
            default: false,
            parseHTML: (element) => element.dataset.omitIfMissing === "true",
            renderHTML: (attributes) => (attributes.omitIfMissing ? { "data-omit-if-missing": "true" } : {}),
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      indentBy:
        (by) =>
        ({ state, tr, dispatch }) => {
          let changed = false;
          state.doc.nodesBetween(state.selection.from, state.selection.to, (node, pos) => {
            if (node.type.name !== "paragraph" && node.type.name !== "heading") return true;
            const next = Math.min(3, Math.max(0, (Number(node.attrs.indent) || 0) + by));
            if (next !== node.attrs.indent) {
              tr.setNodeMarkup(pos, undefined, { ...node.attrs, indent: next });
              changed = true;
            }
            return false;
          });
          if (changed && dispatch) dispatch(tr);
          return changed;
        },
    };
  },
});

/**
 * The page: ordinary blocks, and the `top` group (tables, live sections, page breaks) that may only sit on the page itself. List items and
 * table cells hold `block` content, so a table, a section or a page break can never be put inside one.
 */
const TopDocument = Node.create({ name: "doc", topNode: true, content: "(block | top)+" });

/** A cell's fill colour. */
const cellBackground = {
  background: {
    default: null,
    parseHTML: (element: HTMLElement) => toHex(element.dataset.background ?? element.style.backgroundColor),
    renderHTML: (attributes: Record<string, unknown>) => (attributes.background ? { "data-background": attributes.background, style: `background-color: ${String(attributes.background)}` } : {}),
  },
};
const Cell = TableCell.extend({ addAttributes: () => ({ ...TableCell.config.addAttributes?.call(TableCell as never), ...cellBackground }) });
const HeaderCell = TableHeader.extend({ addAttributes: () => ({ ...TableHeader.config.addAttributes?.call(TableHeader as never), ...cellBackground }) });

/** A merge field: an inline chip that prints the value. */
const Variable = Node.create({
  name: "variable",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  addAttributes: () => ({ name: { default: null, parseHTML: (element) => element.dataset.variable ?? null } }),
  parseHTML: () => [{ tag: "span[data-variable]" }],
  renderHTML: ({ node, HTMLAttributes }) => [
    "span",
    mergeAttributes(HTMLAttributes, { "data-variable": node.attrs.name, class: "rich-field", contenteditable: "false" }),
    VARIABLE_LABELS[node.attrs.name as keyof typeof VARIABLE_LABELS] ?? String(node.attrs.name),
  ],
  renderText: ({ node }) => `{{${String(node.attrs.name)}}}`,
  addNodeView: () => ReactNodeViewRenderer(VariableView),
});

/** A live section: drawn from each agreement's own data. Top level only, like the PDF draws it. */
const Section = Node.create({
  name: "section",
  group: "top",
  atom: true,
  draggable: true,
  selectable: true,
  addAttributes: () => ({
    key: { default: null, parseHTML: (element) => element.dataset.section ?? null },
    options: { default: null, parseHTML: (element) => { try { return JSON.parse(element.dataset.options ?? "null"); } catch { return null; } } },
  }),
  parseHTML: () => [{ tag: "div[data-section]" }],
  renderHTML: ({ node, HTMLAttributes }) => ["div", mergeAttributes(HTMLAttributes, { "data-section": node.attrs.key, "data-options": JSON.stringify(node.attrs.options ?? null) })],
  addNodeView: () => ReactNodeViewRenderer(SectionView),
});

/** The company's own logo from Settings. */
const CompanyLogo = Node.create({
  name: "companyLogo",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,
  addAttributes: () => ({
    size: { default: "medium", parseHTML: (element) => element.dataset.size ?? "medium" },
    align: { default: "left", parseHTML: (element) => element.dataset.align ?? "left" },
  }),
  parseHTML: () => [{ tag: "div[data-company-logo]" }],
  renderHTML: ({ node, HTMLAttributes }) => ["div", mergeAttributes(HTMLAttributes, { "data-company-logo": "", "data-size": node.attrs.size, "data-align": node.attrs.align })],
  addNodeView: () => ReactNodeViewRenderer(LogoView),
});

/** A picture the tenant uploaded. Pasted pictures from elsewhere have no upload key and are dropped. */
const Picture = Node.create({
  name: "image",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,
  addAttributes: () => ({
    asset: { default: null, parseHTML: (element) => element.dataset.asset ?? null },
    width: { default: 50, parseHTML: (element) => Number(element.dataset.width) || 50 },
    align: { default: "center", parseHTML: (element) => element.dataset.align ?? "center" },
  }),
  parseHTML: () => [{ tag: "div[data-asset]" }],
  renderHTML: ({ node, HTMLAttributes }) => ["div", mergeAttributes(HTMLAttributes, { "data-asset": node.attrs.asset, "data-width": node.attrs.width, "data-align": node.attrs.align })],
  addNodeView: () => ReactNodeViewRenderer(ImageView),
});

const PageBreak = Node.create({
  name: "pageBreak",
  group: "top",
  atom: true,
  selectable: true,
  parseHTML: () => [{ tag: "div[data-page-break]" }],
  renderHTML: () => ["div", { "data-page-break": "", class: "rich-page-break", contenteditable: "false" }, ["span", {}, "Page break"]],
});

/**
 * Where a part that sits on the page goes: after the selected part (a section, a picture), or after the top-level block the cursor is
 * in, so a section, a table or a page break never lands inside a table or a list, and never replaces what is selected.
 */
function topInsertPosition(state: EditorState): number {
  const selection = state.selection;
  if (selection instanceof NodeSelection && selection.$from.depth === 0) return selection.to;
  return selection.$from.depth === 0 ? selection.$from.pos : selection.$from.after(1);
}

/** A selected part (a section, a picture, the logo, a line) is never replaced by an insert: the new content goes right after it. */
const selectedBlockEnd = (state: EditorState): number | null =>
  state.selection instanceof NodeSelection && state.selection.node.isBlock ? state.selection.to : null;

/** The commands that insert the app's own parts. */
const Inserts = Extension.create({
  name: "inserts",
  addCommands() {
    return {
      insertField:
        (name) =>
        ({ state, chain }) => {
          const field = { type: "variable", attrs: { name } };
          const after = selectedBlockEnd(state);
          return after === null ? chain().insertContent(field).run() : chain().insertContentAt(after, { type: "paragraph", content: [field] }).run();
        },
      insertSection:
        (key) =>
        ({ state, chain }) =>
          chain().insertContentAt(topInsertPosition(state), { type: "section", attrs: { key, options: null } }).run(),
      insertPageBreak:
        () =>
        ({ state, chain }) =>
          chain().insertContentAt(topInsertPosition(state), [{ type: "pageBreak" }, { type: "paragraph" }]).run(),
      insertCompanyLogo:
        () =>
        ({ state, chain }) => {
          const logo = { type: "companyLogo", attrs: { size: "medium", align: "left" } };
          const after = selectedBlockEnd(state);
          return after === null ? chain().insertContent(logo).run() : chain().insertContentAt(after, logo).run();
        },
      insertPicture:
        (asset) =>
        ({ state, chain }) => {
          const picture = { type: "image", attrs: { asset, width: 50, align: "center" } };
          const after = selectedBlockEnd(state);
          return after === null ? chain().insertContent(picture).run() : chain().insertContentAt(after, picture).run();
        },
    };
  },
});

/** Every extension the editor runs with. */
export function richExtensions(placeholder: string): AnyExtension[] {
  return [
    TopDocument,
    StarterKit.configure({
      document: false,
      code: false,
      codeBlock: false,
      blockquote: false,
      heading: { levels: [1, 2, 3] },
      link: { openOnClick: false, autolink: true, protocols: ["https"], defaultProtocol: "https", isAllowedUri: (url) => /^https:\/\//i.test(url) },
    }),
    TextStyle,
    Color,
    FontStyle,
    Highlight.configure({ multicolor: true }),
    TextAlign.configure({ types: ["heading", "paragraph"], alignments: ["left", "center", "right", "justify"] }),
    Table.extend({ group: "top" }).configure({ resizable: true, cellMinWidth: 40 }),
    TableRow,
    HeaderCell,
    Cell,
    BlockSettings,
    Variable,
    Section,
    CompanyLogo,
    Picture,
    PageBreak,
    Inserts,
    Placeholder.configure({ placeholder }),
  ];
}
