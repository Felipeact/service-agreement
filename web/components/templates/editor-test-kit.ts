import { act } from "react";
import { rowsFromLayout, type LayoutFormState } from "@/domain/agreement/layout-form";
import { layoutFormFromBody, type AgreementLayoutForm } from "@/domain/agreement/template-form";

/** Shared by the editor's component tests: forms to start from and the few DOM moves every test makes. */

const DOC = { title: "Preventive maintenance service agreement", showMeta: true, pageHeader: "first", pageFooter: "number" } as const;

export const AGREEMENT: AgreementLayoutForm = layoutFormFromBody({
  schema: 2,
  name: "Quarterly service",
  description: "",
  doc: { ...DOC },
  layout: [
    { kind: "block", type: "heading", text: "About this agreement" },
    { kind: "block", type: "paragraph", text: "Prepared for {{customer.name}}." },
    { kind: "section", key: "price" },
    { kind: "section", key: "schedule" },
    { kind: "section", key: "included" },
    { kind: "section", key: "equipment" },
    { kind: "section", key: "terms" },
  ],
  preset: { termMonths: 12, lines: [] },
});

export const CONTRACT: LayoutFormState = {
  doc: { ...DOC, title: "Service contract" },
  layout: rowsFromLayout([
    { kind: "section", key: "price" },
    { kind: "block", type: "clause", text: "Invoices are payable within {{terms.paymentDays}}." },
    { kind: "section", key: "signatures" },
  ]),
};

const VALUE_SETTERS = {
  input: Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!,
  textarea: Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!,
  select: Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")!.set!,
};

/** Types into a controlled field the way a person does, so React sees the change. */
export async function setValue(field: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string) {
  const tag = field.tagName.toLowerCase() as keyof typeof VALUE_SETTERS;
  await act(async () => {
    VALUE_SETTERS[tag].call(field, value);
    field.dispatchEvent(new Event(tag === "select" ? "change" : "input", { bubbles: true }));
  });
}

export const click = (element: Element | null | undefined) => act(async () => (element as HTMLElement).click());

/** The first element matching `selector` whose text is exactly `text`. */
export const withText = (root: ParentNode, selector: string, text: string) => [...root.querySelectorAll(selector)].find((element) => (element.textContent ?? "").trim() === text) as HTMLElement | undefined;

/** The blocks on the page, in order. */
export const pageItems = (root: ParentNode) => [...root.querySelectorAll('article[aria-label="Document page"] > ol > li')] as HTMLElement[];

/** The block frame of the nth item: the clickable frame when it is not selected, the group when it is. */
export const frameOf = (root: ParentNode, index: number) => pageItems(root)[index].querySelector('[role="button"], [role="group"]') as HTMLElement;

export const selectItem = (root: ParentNode, index: number) => click(frameOf(root, index));

/** Labels of the buttons inside the selected block's toolbar. */
export const toolbar = (root: ParentNode) => [...root.querySelectorAll('[role="toolbar"] button')].map((button) => button.getAttribute("aria-label") ?? "");
