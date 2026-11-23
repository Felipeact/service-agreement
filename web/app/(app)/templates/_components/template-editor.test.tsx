// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { bodyFromRichForm, EMPTY_RICH_FORM, richFormFromBody, STANDARD_HEADER, type AgreementRichForm } from "@/domain/agreement/rich-form";
import { SYSTEM_CONTRACT_BODY } from "@/domain/contract";
import { contractRichFormFromBody } from "@/domain/contract/rich-form";
import { normalizeRichDoc } from "@/domain/rich-document";
import type { AgreementTemplateBodyV2 } from "@/domain/agreement/template";
import { ContractWordingEditor } from "./contract-wording-editor";
import { ENV, settle, stubLayout } from "./rich-editor/editor.testing";
import { TemplateEditor } from "./template-editor";
import type { SaveTemplateState } from "./state";

vi.mock("next/dynamic", async () => (await import("./rich-editor/editor.testing")).dynamicModule);
vi.mock("../_actions/image", () => ({ prepareTemplateImageAction: vi.fn() }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  stubLayout();
  fetchMock = vi.fn(async () => new Response(new Blob(["%PDF-1.4"], { type: "application/pdf" }), { headers: { "Content-Type": "application/pdf" } }));
  vi.stubGlobal("fetch", fetchMock);
  URL.createObjectURL = vi.fn(() => "blob:preview");
  URL.revokeObjectURL = vi.fn();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const save = vi.fn(async (): Promise<SaveTemplateState> => ({ status: "idle" }));
const mount = async (initial: AgreementRichForm = EMPTY_RICH_FORM, answer?: SaveTemplateState) => {
  save.mockClear();
  if (answer) save.mockResolvedValueOnce(answer);
  await act(async () => root.render(createElement(TemplateEditor, { templateId: null, initial, types: [{ code: "RTU", name: "Rooftop units" }], save, env: ENV })));
  await settle(act);
};
const buttons = () => [...document.querySelectorAll("button")];
const button = (name: string | RegExp) => buttons().find((each) => (typeof name === "string" ? each.textContent?.trim() === name || each.getAttribute("aria-label") === name : name.test(each.textContent ?? ""))) as HTMLButtonElement | undefined;
const click = async (element: Element | undefined | null) => {
  if (!element) throw new Error("nothing to click");
  await act(async () => (element as HTMLElement).click());
  await settle(act);
};
const type = async (field: HTMLInputElement | HTMLTextAreaElement, value: string) => {
  const prototype = field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  await act(async () => {
    Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(field, value);
    field.dispatchEvent(new Event("input", { bubbles: true }));
  });
};
const submit = async () => {
  await act(async () => container.querySelector("form")!.requestSubmit());
  await settle(act);
};
/** The form's values follow the page once typing pauses (200 ms). */
const pause = () => act(async () => new Promise((resolve) => setTimeout(resolve, 250)));
const sent = () => (save.mock.calls.at(-1) as unknown as [string | null, AgreementRichForm])[1];
const page = () => container.querySelector('[aria-label="Page"]') as HTMLElement;
const header = () => container.querySelector('section[aria-label="Header"]') as HTMLElement;
const tab = (name: string) => click(buttons().find((each) => each.getAttribute("role") === "tab" && each.textContent?.trim() === name));
const insertField = async (name: string) => {
  await click(button("Field"));
  await click(button(name));
};

describe("a blank page", () => {
  test("a new template is an empty page under the standard header, with no title, and says it shows no price yet", async () => {
    await mount();
    expect(header().hidden).toBe(false);
    expect(header().querySelector('[data-variable="tenant.legalName"]')?.textContent).toBe("Your company name");
    expect(header().querySelector("[data-company-logo-view]")).not.toBeNull();
    expect((container.querySelector("#document-title") as HTMLInputElement).value).toBe("");
    expect(page().textContent).toBe("");
    expect(container.textContent).toContain("No price lines table: your customer won't see prices on this agreement.");
    expect(container.querySelector("[data-save-state]")?.textContent).toBe("Saved");
    expect(buttons().filter((each) => each.getAttribute("role") === "tab").map((each) => each.textContent)).toEqual(["Home", "Insert", "Page"]);
  });
});

describe("the ribbon", () => {
  test("Insert puts the price lines table on the page as live data; its tile says it is on the page, and the warning goes", async () => {
    await mount();
    await tab("Insert");
    await click(button(/^Price lines/));
    expect(page().querySelector('[data-live-section="price"]')?.textContent).toContain("Live data");
    expect(button(/^Price lines/)?.disabled).toBe(true);
    expect(button(/^Price lines/)?.textContent).toContain("On the page");
    await pause();
    expect(container.textContent).not.toContain("No price lines table");
    expect(container.querySelector("[data-save-state]")?.textContent).toBe("Unsaved changes");
  });

  test("a section just put down shows its options beside the page: title, five column labels, visits format, preset lines, removal", async () => {
    await mount();
    await tab("Insert");
    await click(button(/^Price lines/));
    const card = container.querySelector('aside[aria-label="Selected part"] section[aria-label="Price lines table"]') as HTMLElement;
    expect(card).not.toBeNull();
    const labels = [...card.querySelectorAll("label, legend")].map((label) => label.textContent?.trim() ?? "");
    for (const label of ["Title", "Description column", "Visits column", "Per visit column", "Per year column", "Total row"]) expect(labels.some((each) => each.startsWith(label))).toBe(true);
    expect(card.querySelector('section[aria-label="Preset lines"]')).not.toBeNull();
    expect(button("Remove from the page")).toBeDefined();
  });

  test("a field goes in at the cursor as a chip with its plain name", async () => {
    await mount();
    await tab("Insert");
    await insertField("Customer name");
    expect(page().querySelector('[data-variable="customer.name"]')?.textContent).toBe("Customer name");
  });

  test("the schedule and the terms are offered; signatures belong to the contract only", async () => {
    await mount();
    await tab("Insert");
    expect(button(/^Visit schedule/)).toBeDefined();
    expect(button(/^Terms/)).toBeDefined();
    expect(button(/^Signatures/)).toBeUndefined();
  });

  test("[C21] the Page tab turns the number lines on and sets the footer, as tiles", async () => {
    await mount();
    await tab("Page");
    await click(button("Number and customer"));
    expect(button("Number and customer")?.getAttribute("aria-pressed")).toBe("true");
    expect(container.textContent).toContain("AG-0000");
    await click(button("Company details"));
    expect(container.querySelector('footer[aria-label="Page footer"]')?.textContent).toContain(ENV.orgName);
  });
});

describe("the header", () => {
  test("the header is edited as its own part: the ribbon says so, and Insert offers no live sections or page breaks there", async () => {
    await mount();
    await act(async () => (container.querySelector('[aria-label="Header"][contenteditable]') as HTMLElement).focus());
    await settle(act);
    expect(container.textContent).toContain("Editing the header");
    await tab("Insert");
    expect(button(/^Price lines/)).toBeUndefined();
    expect(button("Page break")).toBeUndefined();
    expect(button("Logo")).toBeDefined();
  });

  test("the header can be removed and added back as it was; a save without it sends no header", async () => {
    await mount();
    await type(container.querySelector("#template-name") as HTMLInputElement, "No letterhead");
    await click(button("Remove the header"));
    expect(header().hidden).toBe(true);
    expect(button("Add a header")).toBeDefined();
    await submit();
    expect(sent().header).toBeNull();
    expect(bodyFromRichForm(sent()).ok).toBe(true);

    await click(button("Add a header"));
    expect(header().hidden).toBe(false);
    await submit();
    expect(normalizeRichDoc(sent().header)).toEqual(normalizeRichDoc(STANDARD_HEADER));
  });

  test("the Page tab can take the header away, put it on every page, and bring it back", async () => {
    await mount();
    await tab("Page");
    await click(button("Every page"));
    expect(header().textContent).toContain("Header, every page");
    await click(button("No header"));
    expect(header().hidden).toBe(true);
    expect(button("Every page")?.disabled).toBe(true);
    await click(button("Header"));
    expect(header().hidden).toBe(false);
  });
});

describe("saving", () => {
  test("Save sends the page and the header as they are at that moment, with the section's title and the preset lines", async () => {
    await mount();
    await type(container.querySelector("#template-name") as HTMLInputElement, "Quarterly rooftop care");
    await tab("Insert");
    await click(button(/^Price lines/));
    await type(container.querySelector('section[aria-label="Price lines table"] input[name^="sectionTitle"]') as HTMLInputElement, "Your price ");
    await click(button("Add line"));
    await type(container.querySelector('section[aria-label="Preset lines"] input') as HTMLInputElement, "Quarterly visit");
    await insertField("Customer name");
    await submit();
    expect(save).toHaveBeenCalledTimes(1);
    expect((save.mock.calls[0] as unknown as [string | null])[0]).toBeNull();
    const form = sent();
    expect(form.name).toBe("Quarterly rooftop care");
    expect(form.lines[0].description).toBe("Quarterly visit");
    const json = JSON.stringify(form.content);
    expect(json).toContain('"key":"price"');
    expect(json).toContain('"title":"Your price"');
    expect(json).toContain('"name":"customer.name"');
    expect(JSON.stringify(form.header)).toContain('"name":"tenant.legalName"');
    const body = bodyFromRichForm({ ...form, lines: form.lines.map((line) => ({ ...line, visitMonths: [3, 6, 9, 12] })) });
    expect(body.ok ? [] : body.errors).toEqual([]);
  });

  test("a refused save keeps what was typed and lists the message under Before you save", async () => {
    await mount(EMPTY_RICH_FORM, { status: "invalid", errors: { name: "Another template already has this name. Choose a different one." }, values: EMPTY_RICH_FORM });
    await type(container.querySelector("#template-name") as HTMLInputElement, "Taken");
    await submit();
    expect((container.querySelector("#template-name") as HTMLInputElement).value).toBe("Taken");
    expect(container.textContent).toContain("Another template already has this name. Choose a different one.");
    expect(container.textContent).toContain("Fix what is listed under Before you save, then save again.");
  });
});

describe("the preview page", () => {
  test("Preview draws the page and its header as they are now, unsaved, on sample data, then on a chosen agreement; Edit brings them back", async () => {
    await mount();
    await tab("Insert");
    await click(button(/^Price lines/));
    await click(button("Preview"));
    const [url, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit];
    expect(url).toBe("/templates/preview");
    expect(String(init.body)).toContain('"key":"price"');
    expect(String(init.body)).toContain('"header":{"type":"doc"');
    expect(container.querySelector('iframe[title="Agreement PDF preview"]')?.getAttribute("src")).toBe("blob:preview#toolbar=0&view=FitH");

    const select = container.querySelector('section[aria-label="Preview"] select') as HTMLSelectElement;
    await act(async () => {
      select.value = ENV.agreements[0].id;
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await settle(act);
    expect((fetchMock.mock.calls.at(-1) as [string])[0]).toBe(`/templates/preview?agreement=${ENV.agreements[0].id}`);

    await click(button("Edit"));
    expect(page().querySelector('[data-live-section="price"]')).not.toBeNull();
  });

  test("a page that cannot be drawn says what to do", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ errors: [] }), { status: 422 }));
    await mount();
    await click(button("Preview"));
    expect(container.textContent).toContain("Fix what the page lists under Before you save, then preview again.");
  });
});

describe("top bar controls and older templates", () => {
  test("[C22] Details holds the description and the term length; the name sits in the top bar", async () => {
    await mount();
    await click(button("Details"));
    const card = container.querySelector('section[aria-label="Details"]') as HTMLElement;
    await type(card.querySelector("#template-description") as HTMLTextAreaElement, "Rooftops four times a year");
    await type(card.querySelector("#template-term") as HTMLInputElement, "24");
    await type(container.querySelector("#template-name") as HTMLInputElement, "Rooftops");
    await submit();
    expect(sent()).toMatchObject({ name: "Rooftops", description: "Rooftops four times a year", termMonths: "24" });
  });

  test("[C22] the contract editor has no Details and no name field, and offers the signatures it already holds", async () => {
    await act(async () => root.render(createElement(ContractWordingEditor, { initial: contractRichFormFromBody(SYSTEM_CONTRACT_BODY), save: vi.fn(), env: ENV })));
    await settle(act);
    expect(button("Details")).toBeUndefined();
    expect(container.querySelector("#template-name")).toBeNull();
    await tab("Insert");
    expect(button(/^Signatures/)?.disabled).toBe(true);
    expect(page().querySelector('[data-live-section="signatures"]')).not.toBeNull();
  });

  test("a schema 2 template opens with its letterhead as an editable header, its blocks, table and sections, and saves as a designed page", async () => {
    const body: AgreementTemplateBodyV2 = {
      schema: 2,
      name: "Old style",
      description: "",
      doc: { title: "Maintenance schedule", showMeta: true, pageHeader: "every", pageFooter: "number", letterhead: { logo: false, logoSize: "medium", align: "center", name: true, address: false, phone: true } },
      layout: [
        { kind: "block", type: "heading", text: "Hello {{customer.name}}" },
        { kind: "table", header: true, rows: [["Visit", "Month"], ["Spring", "April"]] },
        { kind: "section", key: "price" },
        { kind: "section", key: "terms" },
      ],
      preset: { termMonths: 12, lines: [] },
    };
    await mount(richFormFromBody(body));
    expect(header().querySelector("[data-company-logo-view]")).toBeNull();
    expect(header().querySelector('[data-variable="tenant.phone"]')).not.toBeNull();
    expect(header().querySelector('[data-variable="tenant.address"]')).toBeNull();
    expect(header().textContent).toContain("Header, every page");
    expect(page().textContent).toContain("Hello Customer name");
    expect(page().querySelector("table")?.textContent).toContain("Spring");
    expect(page().querySelectorAll("[data-live-section]")).toHaveLength(2);
    await submit();
    expect(bodyFromRichForm(sent()).ok).toBe(true);
  });
});
