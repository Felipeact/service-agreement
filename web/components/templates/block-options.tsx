"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { MonthGrid, monthBox, monthChoice } from "@/components/ui/month-grid";
import { Select } from "@/components/ui/select";
import { TextArea } from "@/components/ui/text-area";
import { TextInput } from "@/components/ui/text-input";
import { useItemWords } from "@/components/shell/item-words";
import { MONTH_PRESETS, type MonthPreset } from "@/domain/agreement";
import { PAGE_FOOTERS, PRICE_COLUMN_KEYS, type DocOptions, type PageFooter, type PriceColumns, type VisitsFormat } from "@/domain/agreement/layout";
import type { SectionRow } from "@/domain/agreement/layout-form";
import { MAX_DESCRIPTION, MAX_PRESET_LINES } from "@/domain/agreement/template";
import { EMPTY_PRESET_LINE, type TemplateFormLine } from "@/domain/agreement/template-form";
import { itemText } from "@/domain/org-settings";
import { Switch } from "./switch";

const COLUMN_LABELS: Record<keyof PriceColumns, { label: string; placeholder: string }> = {
  description: { label: "Description column", placeholder: "Description" },
  visits: { label: "Visits column", placeholder: "Visits per year" },
  perVisit: { label: "Per visit column", placeholder: "Per visit" },
  perYear: { label: "Per year column", placeholder: "Per year" },
  total: { label: "Total row", placeholder: "Total per year" },
};

const FOOTER_LABELS: Record<PageFooter, string> = {
  number: "Agreement number and page count",
  letterhead: "Company name, address and phone",
};

/** A small card that sits under the selected block or in the header: a heading, then its fields. */
export function OptionsCard({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section aria-label={label} className="flex flex-col gap-3 rounded-panel border border-hairline bg-surface p-4 shadow-card">
      <h2 className="font-display text-[15px] font-semibold tracking-tight">{label}</h2>
      {children}
    </section>
  );
}

type PartProps = { row: SectionRow; id: string; at: (suffix: string) => string | undefined; onChange: (patch: Partial<SectionRow>) => void };

/** The options of the selected part and nothing else: each part has its own, and the terms have none (template-editor-v2 AC 18). */
export function PartOptions({ row, id, at, onChange }: PartProps) {
  const words = useItemWords();
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
    case "schedule":
    case "equipment":
      return title(row.key === "schedule" ? "Visit schedule" : itemText("Equipment", words));
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

type TypeOption = { code: string; name: string };

type PresetProps = {
  lines: TemplateFormLine[];
  types: TypeOption[];
  errors: Record<string, string>;
  onChange: (lines: TemplateFormLine[]) => void;
};

const toggle = <T,>(list: readonly T[], item: T) => (list.includes(item) ? list.filter((other) => other !== item) : [...list, item]);

/** The lines a new agreement starts with, edited under the Price lines part (template-editor-v2 AC 19). */
export function PresetLines({ lines, types, errors, onChange }: PresetProps) {
  const words = useItemWords();
  const setLine = (index: number, patch: Partial<TemplateFormLine>) => onChange(lines.map((line, at) => (at === index ? { ...line, ...patch } : line)));
  const full = lines.length >= MAX_PRESET_LINES;
  return (
    <section aria-label="Preset lines" className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <h3 className="text-[13px] font-semibold text-ink">Preset lines</h3>
        <p className="text-[12px] text-ink-2">Copied into a new agreement as ordinary lines. A price left empty stays empty for the estimator.</p>
      </div>
      {errors["preset.lines"] && <p className="text-[12px] font-medium text-danger">{errors["preset.lines"]}</p>}
      {lines.map((line, index) => {
        const at = (key: string) => errors[`preset.lines.${index}.${key}`];
        const codes = [...types.map((type) => type.code), ...line.assetTypeCodes.filter((code) => !types.some((type) => type.code === code))];
        return (
          <div key={index} className="flex flex-col gap-3 rounded-control border border-hairline p-3">
            <div className="grid gap-3 md:grid-cols-[minmax(0,3fr)_minmax(0,1fr)] md:items-start">
              <TextInput
                id={`line-${index}-description`}
                name={`lineDescription-${index}`}
                label={`Line ${index + 1} description`}
                value={line.description}
                onChange={(event) => setLine(index, { description: event.target.value })}
                error={at("description")}
              />
              <TextInput
                id={`line-${index}-price`}
                name={`linePrice-${index}`}
                label="Price per visit"
                inputMode="decimal"
                placeholder="$0.00"
                value={line.costPerVisit}
                onChange={(event) => setLine(index, { costPerVisit: event.target.value })}
                error={at("costPerVisitCents")}
              />
            </div>
            <MonthGrid
              name={`lineMonths-${index}`}
              legend="Visit months"
              checked={line.visitMonths}
              onToggle={(month) => setLine(index, { visitMonths: toggle(line.visitMonths, month).sort((a, b) => a - b) })}
              onPreset={(preset: MonthPreset) => setLine(index, { visitMonths: [...MONTH_PRESETS[preset]] })}
              error={at("visitMonths")}
              errorId={`line-${index}-months-error`}
            />
            <fieldset className="flex flex-col gap-1.5">
              <legend className="mb-1.5 text-[13px] font-medium text-ink">{itemText("Equipment types", words)}</legend>
              {codes.length === 0 ? (
                <p className="text-[12px] text-ink-2">{itemText("Your catalog has no equipment types yet.", words)}</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {codes.map((code) => (
                    <label key={code} className={`${monthChoice} px-3`}>
                      <input
                        type="checkbox"
                        name={`lineTypes-${index}`}
                        value={code}
                        checked={line.assetTypeCodes.includes(code)}
                        onChange={() => setLine(index, { assetTypeCodes: toggle(line.assetTypeCodes, code) })}
                        className={monthBox}
                      />
                      {types.find((type) => type.code === code)?.name ?? code}
                    </label>
                  ))}
                </div>
              )}
              {at("assetTypeCodes") && <p className="text-[12px] font-medium text-danger">{at("assetTypeCodes")}</p>}
            </fieldset>
            {errors[`preset.lines.${index}`] && <p className="text-[12px] font-medium text-danger">{errors[`preset.lines.${index}`]}</p>}
            <div className="flex justify-end">
              <Button onClick={() => onChange(lines.filter((_, at) => at !== index))}>{`Remove line ${index + 1}`}</Button>
            </div>
          </div>
        );
      })}
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => onChange([...lines, { ...EMPTY_PRESET_LINE }])} disabled={full}>
          Add line
        </Button>
        {full && <span className="text-[12px] text-ink-2">{`A template can have at most ${MAX_PRESET_LINES} lines.`}</span>}
      </div>
    </section>
  );
}

/** The three document options and nothing else (template-editor-v2 AC 21): the number, customer and site lines, the letterhead, the footer. */
export function PageSettingsFields({ doc, onChange, errors }: { doc: DocOptions; onChange: (next: DocOptions) => void; errors: Record<string, string> }) {
  const set = (patch: Partial<DocOptions>) => onChange({ ...doc, ...patch });
  return (
    <div className="flex flex-col gap-1">
      <Switch id="page-meta" label="Show the number, customer and site lines" hint="The lines under the title: number, customer, site, term and validity." checked={doc.showMeta} onChange={(showMeta) => set({ showMeta })} error={errors["doc.showMeta"]} />
      <Switch id="page-header" label="Letterhead on every page" hint="Otherwise the letterhead is drawn on the first page only." checked={doc.pageHeader === "every"} onChange={(every) => set({ pageHeader: every ? "every" : "first" })} error={errors["doc.pageHeader"]} />
      <Select id="page-footer" name="docFooter" label="Footer" value={doc.pageFooter} onChange={(event) => set({ pageFooter: event.target.value as PageFooter })} error={errors["doc.pageFooter"]} className="sm:max-w-sm">
        {PAGE_FOOTERS.map((footer) => (
          <option key={footer} value={footer}>
            {FOOTER_LABELS[footer]}
          </option>
        ))}
      </Select>
    </div>
  );
}

/** The agreement template's description and term length (template-editor-v2 AC 22); the name lives in the header. */
export function DetailsFields({ description, termMonths, onChange, errors }: { description: string; termMonths: string; onChange: (patch: { description?: string; termMonths?: string }) => void; errors: Record<string, string> }) {
  return (
    <div className="flex flex-col gap-3">
      <TextArea id="template-description" name="description" label="Description" rows={2} value={description} onChange={(event) => onChange({ description: event.target.value })} hint={`Up to ${MAX_DESCRIPTION} characters. Shown on the template's card.`} error={errors.description} />
      <TextInput id="template-term" name="termMonths" label="Term length" inputMode="numeric" placeholder="Months, for example 12" value={termMonths} onChange={(event) => onChange({ termMonths: event.target.value })} error={errors["preset.termMonths"]} className="sm:max-w-xs" />
    </div>
  );
}

/** A header button that opens a card of fields under it and closes again; nothing here needs hover. */
export function HeaderPopover({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <Button onClick={() => setOpen((was) => !was)} aria-expanded={open}>
        {label}
      </Button>
      {open && <div className="absolute right-0 z-20 mt-2 w-[min(22rem,calc(100vw-2rem))]">{<OptionsCard label={label}>{children}</OptionsCard>}</div>}
    </div>
  );
}
