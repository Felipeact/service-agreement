"use client";

import { Select } from "@/components/ui/select";
import { TextInput } from "@/components/ui/text-input";
import { PAGE_FOOTERS, type DocOptions, type PageFooter } from "@/domain/agreement/layout";
import { Switch } from "./switch";

const FOOTER_LABELS: Record<PageFooter, string> = {
  number: "Agreement number and page count",
  letterhead: "Company name, address and phone",
};

type Props = {
  doc: DocOptions;
  onChange: (next: DocOptions) => void;
  /** Messages by the validator's field name (`doc.title`, `doc.showMeta`...). */
  errors?: Record<string, string>;
  idPrefix?: string;
};

/** The document options (block-editor AC 29): the title, the meta lines, the repeated letterhead and the footer style. */
export function DocumentOptionsPanel({ doc, onChange, errors = {}, idPrefix = "doc" }: Props) {
  const set = (patch: Partial<DocOptions>) => onChange({ ...doc, ...patch });
  return (
    <section aria-label="Document options" className="flex flex-col gap-3 rounded-panel border border-hairline bg-surface p-4 shadow-card">
      <div className="flex flex-col gap-0.5">
        <h2 className="font-display text-[18px] font-semibold tracking-tight">Document options</h2>
        <p className="text-[13px] text-ink-2">How the document opens and what every page repeats.</p>
      </div>
      <TextInput
        id={`${idPrefix}-title`}
        name="docTitle"
        label="Title"
        value={doc.title}
        onChange={(event) => set({ title: event.target.value })}
        error={errors["doc.title"]}
      />
      <fieldset className="flex flex-col gap-1">
        <legend className="sr-only">Lines and repeated parts</legend>
        <Switch
          id={`${idPrefix}-meta`}
          label="Show the number, customer and site lines"
          hint="The lines under the title: number, customer, site, term and validity."
          checked={doc.showMeta}
          onChange={(showMeta) => set({ showMeta })}
          error={errors["doc.showMeta"]}
        />
        <Switch
          id={`${idPrefix}-header`}
          label="Letterhead on every page"
          hint="Otherwise the letterhead is drawn on the first page only."
          checked={doc.pageHeader === "every"}
          onChange={(every) => set({ pageHeader: every ? "every" : "first" })}
          error={errors["doc.pageHeader"]}
        />
      </fieldset>
      <Select
        id={`${idPrefix}-footer`}
        name="docFooter"
        label="Footer"
        value={doc.pageFooter}
        onChange={(event) => set({ pageFooter: event.target.value as PageFooter })}
        error={errors["doc.pageFooter"]}
        className="sm:max-w-sm"
      >
        {PAGE_FOOTERS.map((footer) => (
          <option key={footer} value={footer}>
            {FOOTER_LABELS[footer]}
          </option>
        ))}
      </Select>
    </section>
  );
}
