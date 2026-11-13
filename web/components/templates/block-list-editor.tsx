"use client";

import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { TextArea } from "@/components/ui/text-area";
import { TextInput } from "@/components/ui/text-input";
import { useItemWords } from "@/components/shell/item-words";
import { BLOCK_TYPES, TEMPLATE_VARIABLES, type BlockType } from "@/domain/contract/template";
import {
  AGREEMENT_SECTION_KEYS,
  CONTRACT_SECTION_KEYS,
  MAX_INDENT,
  MAX_LAYOUT_BLOCKS,
  MAX_LAYOUT_ITEMS,
  PRICE_COLUMN_KEYS,
  type PriceColumns,
  type SectionKey,
  type VisitsFormat,
} from "@/domain/agreement/layout";
import { newBlockRow, newSectionRow, type BlockRow, type LayoutRow, type SectionRow } from "@/domain/agreement/layout-form";
import { itemText, type ItemWords } from "@/domain/org-settings";
import { Switch } from "./switch";

export type LayoutDocument = "agreement" | "contract";

const BLOCK_LABELS: Record<BlockType, string> = { heading: "Heading", paragraph: "Paragraph", clause: "Clause" };

const COLUMN_LABELS: Record<keyof PriceColumns, { label: string; placeholder: string }> = {
  description: { label: "Description column", placeholder: "Description" },
  visits: { label: "Visits column", placeholder: "Visits per year" },
  perVisit: { label: "Per visit column", placeholder: "Per visit" },
  perYear: { label: "Per year column", placeholder: "Per year" },
  total: { label: "Total row", placeholder: "Total per year" },
};

const INDENT_LABELS = ["No indent", "Indent 1", "Indent 2", "Indent 3"];

/** Controls in a row: 44px tall below `lg` (block-editor AC 39). */
const ROW_BUTTON = "min-h-11 lg:min-h-0";

const sectionName = (key: SectionKey, words: ItemWords) =>
  ({
    price: "Price table",
    schedule: "Visit schedule",
    included: "Service included",
    equipment: itemText("Equipment", words),
    terms: "Terms",
    signatures: "Signatures",
  })[key];

/** The sections a document has and the ones that can never be hidden: the price table, and a contract's signatures. */
export const SECTIONS_OF: Record<LayoutDocument, { all: readonly SectionKey[]; fixed: readonly SectionKey[] }> = {
  agreement: { all: AGREEMENT_SECTION_KEYS, fixed: ["price"] },
  contract: { all: CONTRACT_SECTION_KEYS, fixed: ["price", "signatures"] },
};

type Props = {
  rows: LayoutRow[];
  onChange: (rows: LayoutRow[]) => void;
  document: LayoutDocument;
  /** Messages by the validator's field name: `layout`, `layout.<row>`, `layout.<row>.text`, `layout.<row>.options.title`... */
  errors?: Record<string, string>;
  idPrefix?: string;
};

/** The field names a row shows beside their own control; every other message of the row is listed under its heading. */
const BESIDE = /^layout\.\d+\.(text|options\.title|options\.customerLabel|options\.contractorLabel|options\.caption|options\.columns\.\w+)$/;

/**
 * The layout as ordered rows (block-editor S4): text blocks and the document's sections, each with its own options, moved by Up and
 * Down, removed or hidden, and added back. Nothing here is hover-only or a drag.
 */
export function BlockListEditor({ rows, onChange, document: kind, errors = {}, idPrefix = "layout" }: Props) {
  const words = useItemWords();
  const { all, fixed } = SECTIONS_OF[kind];
  const hidden = all.filter((key) => !rows.some((row) => row.kind === "section" && row.key === key));
  const blocks = rows.filter((row) => row.kind === "block").length;
  const full = rows.length >= MAX_LAYOUT_ITEMS || blocks >= MAX_LAYOUT_BLOCKS;

  const update = (index: number, patch: Partial<BlockRow> | Partial<SectionRow>) => onChange(rows.map((row, at) => (at === index ? ({ ...row, ...patch } as LayoutRow) : row)));
  const move = (index: number, by: -1 | 1) => {
    const next = [...rows];
    [next[index], next[index + by]] = [next[index + by], next[index]];
    onChange(next);
  };
  const remove = (index: number) => onChange(rows.filter((_, at) => at !== index));

  function insertVariable(index: number, name: string) {
    const row = rows[index];
    if (row.kind !== "block" || name === "") return;
    const field = document.getElementById(`${idPrefix}-${index}-text`) as HTMLTextAreaElement | null;
    const start = Math.min(field?.selectionStart ?? row.text.length, row.text.length);
    const end = Math.min(Math.max(field?.selectionEnd ?? start, start), row.text.length);
    update(index, { text: `${row.text.slice(0, start)}{{${name}}}${row.text.slice(end)}` });
  }

  const rowMessages = (index: number) =>
    Object.entries(errors)
      .filter(([field]) => (field === `layout.${index}` || field.startsWith(`layout.${index}.`)) && !BESIDE.test(field))
      .map(([, message]) => message);

  return (
    <section aria-label="Layout" className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <h2 className="font-display text-[18px] font-semibold tracking-tight">Layout</h2>
        <p className="text-[13px] text-ink-2">The document draws these rows in order, after its title block. Use Up and Down to move a row.</p>
      </div>
      {errors.layout && <p className="text-[12px] font-medium text-danger">{errors.layout}</p>}

      <ol className="flex flex-col gap-3">
        {rows.map((row, index) => {
          const at = (suffix: string) => errors[`layout.${index}.${suffix}`];
          const id = `${idPrefix}-${index}`;
          const messages = rowMessages(index);
          const canHide = row.kind === "section" && !fixed.includes(row.key);
          const name = row.kind === "block" ? BLOCK_LABELS[row.type] : sectionName(row.key, words);
          return (
            <li key={index} className="flex flex-col gap-3 rounded-panel border border-hairline bg-surface p-4 shadow-card">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="mr-auto text-[13.5px] font-semibold text-ink">{`${index + 1}. ${name}`}</h3>
                <Button className={ROW_BUTTON} onClick={() => move(index, -1)} disabled={index === 0} aria-label={`Move row ${index + 1} up`}>
                  Up
                </Button>
                <Button className={ROW_BUTTON} onClick={() => move(index, 1)} disabled={index === rows.length - 1} aria-label={`Move row ${index + 1} down`}>
                  Down
                </Button>
                {row.kind === "block" && (
                  <Button className={ROW_BUTTON} onClick={() => remove(index)} aria-label={`Remove row ${index + 1}`}>
                    Remove
                  </Button>
                )}
                {canHide && (
                  <Button className={ROW_BUTTON} onClick={() => remove(index)} aria-label={`Hide ${name}`}>
                    Hide
                  </Button>
                )}
              </div>
              {messages.length > 0 && (
                <ul className="flex flex-col gap-0.5">
                  {messages.map((message) => (
                    <li key={message} className="text-[12px] font-medium text-danger">
                      {message}
                    </li>
                  ))}
                </ul>
              )}

              {row.kind === "block" ? (
                <>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Select id={`${id}-type`} label="Type" value={row.type} onChange={(event) => update(index, { type: event.target.value as BlockType })}>
                      {BLOCK_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {BLOCK_LABELS[type]}
                        </option>
                      ))}
                    </Select>
                    {row.type === "heading" && (
                      <Select id={`${id}-level`} label="Level" value={String(row.level)} onChange={(event) => update(index, { level: event.target.value === "1" ? 1 : 2 })}>
                        <option value="1">1 - Title style</option>
                        <option value="2">2 - Section style</option>
                      </Select>
                    )}
                    <Select id={`${id}-indent`} label="Indent" value={String(row.indent)} onChange={(event) => update(index, { indent: Number(event.target.value) as BlockRow["indent"] })}>
                      {Array.from({ length: MAX_INDENT + 1 }, (_, level) => (
                        <option key={level} value={level}>
                          {INDENT_LABELS[level]}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <TextArea id={`${id}-text`} name={`blockText-${index}`} label="Text" rows={row.type === "heading" ? 2 : 4} value={row.text} onChange={(event) => update(index, { text: event.target.value })} error={at("text")} />
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:gap-4">
                    <Select id={`${id}-variable`} label="Insert variable" value="" onChange={(event) => insertVariable(index, event.target.value)} className="sm:w-64">
                      <option value="">Insert variable…</option>
                      {TEMPLATE_VARIABLES.map((variable) => (
                        <option key={variable} value={variable}>
                          {variable}
                        </option>
                      ))}
                    </Select>
                    <Switch id={`${id}-break`} label="Start a new page before this" checked={row.pageBreakBefore} onChange={(pageBreakBefore) => update(index, { pageBreakBefore })} />
                  </div>
                </>
              ) : (
                <SectionOptions row={row} id={id} words={words} at={at} onChange={(patch) => update(index, patch)} />
              )}
            </li>
          );
        })}
      </ol>

      <div role="group" aria-label="Add block" className="flex flex-col gap-1.5">
        <p className="text-[13px] font-medium text-ink">Add block</p>
        <div className="flex flex-wrap gap-2">
          {BLOCK_TYPES.map((type) => (
            <Button key={type} className={ROW_BUTTON} onClick={() => onChange([...rows, newBlockRow(type)])} disabled={full}>
              {BLOCK_LABELS[type]}
            </Button>
          ))}
        </div>
        {full && <p className="text-[12px] text-ink-2">{`A layout can have at most ${MAX_LAYOUT_ITEMS} rows and ${MAX_LAYOUT_BLOCKS} text blocks.`}</p>}
      </div>

      {hidden.length > 0 && (
        <section aria-label="Hidden sections" className="flex flex-col gap-1.5">
          <p className="text-[13px] font-medium text-ink">Hidden sections</p>
          <ul className="flex flex-col gap-2">
            {hidden.map((key) => (
              <li key={key} className="flex flex-wrap items-center gap-3">
                <span className="mr-auto text-[13px] text-ink-2">{sectionName(key, words)}</span>
                <Button className={ROW_BUTTON} onClick={() => onChange([...rows, newSectionRow(key)])} disabled={rows.length >= MAX_LAYOUT_ITEMS} aria-label={`Show ${sectionName(key, words)}`}>
                  Show
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </section>
  );
}

function SectionOptions({
  row,
  id,
  words,
  at,
  onChange,
}: {
  row: SectionRow;
  id: string;
  words: ItemWords;
  at: (suffix: string) => string | undefined;
  onChange: (patch: Partial<SectionRow>) => void;
}) {
  const title = (placeholder: string) => (
    <TextInput id={`${id}-title`} name={`sectionTitle-${id}`} label="Title" placeholder={placeholder} value={row.title} onChange={(event) => onChange({ title: event.target.value })} error={at("options.title")} />
  );
  switch (row.key) {
    case "price":
      return (
        <div className="flex flex-col gap-3">
          {title("Service and price")}
          <fieldset className="flex flex-col gap-3">
            <legend className="mb-1.5 text-[13px] font-medium text-ink">Column labels</legend>
            <p className="-mt-1 text-[12px] text-ink-2">Leave all five empty to use the standard labels.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {PRICE_COLUMN_KEYS.map((key) => (
                <TextInput
                  key={key}
                  id={`${id}-column-${key}`}
                  name={`column-${id}-${key}`}
                  label={COLUMN_LABELS[key].label}
                  placeholder={COLUMN_LABELS[key].placeholder}
                  value={row.columns[key]}
                  onChange={(event) => onChange({ columns: { ...row.columns, [key]: event.target.value } })}
                  error={at(`options.columns.${key}`)}
                />
              ))}
            </div>
          </fieldset>
          <Select
            id={`${id}-visits-format`}
            name={`visitsFormat-${id}`}
            label="Visits format"
            value={row.visitsFormat}
            onChange={(event) => onChange({ visitsFormat: event.target.value as VisitsFormat })}
            className="sm:max-w-sm"
          >
            <option value="number">A number (4)</option>
            <option value="times_per_year">Times per year (4 times per year)</option>
          </Select>
        </div>
      );
    case "included":
      return (
        <div className="flex flex-col gap-1">
          {title("Service included")}
          <Switch id={`${id}-frequency`} label="Show the frequency in each heading" hint="For example AHU (QUARTERLY)." checked={row.showFrequency} onChange={(showFrequency) => onChange({ showFrequency })} />
          <Switch id={`${id}-uppercase`} label="Capital letters in each heading" checked={row.uppercase} onChange={(uppercase) => onChange({ uppercase })} />
        </div>
      );
    case "equipment":
      return title(itemText("Equipment", words));
    case "schedule":
      return title("Visit schedule");
    case "signatures":
      return (
        <div className="flex flex-col gap-3">
          <TextInput
            id={`${id}-customer-label`}
            name={`customerLabel-${id}`}
            label="Customer label"
            placeholder="For the Customer: signer name"
            value={row.customerLabel}
            onChange={(event) => onChange({ customerLabel: event.target.value })}
            error={at("options.customerLabel")}
          />
          <TextInput
            id={`${id}-contractor-label`}
            name={`contractorLabel-${id}`}
            label="Contractor label"
            placeholder="For your company"
            value={row.contractorLabel}
            onChange={(event) => onChange({ contractorLabel: event.target.value })}
            error={at("options.contractorLabel")}
          />
          <TextInput id={`${id}-caption`} name={`caption-${id}`} label="Caption" value={row.caption} onChange={(event) => onChange({ caption: event.target.value })} error={at("options.caption")} />
          <Switch id={`${id}-name-field`} label="Name and title line" hint="Adds a printed name and title line for the customer." checked={row.nameField} onChange={(nameField) => onChange({ nameField })} />
        </div>
      );
    case "terms":
      return <p className="text-[13px] text-ink-2">Prints the agreement terms. It has no options.</p>;
  }
}
