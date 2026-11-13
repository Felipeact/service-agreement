"use client";

import { useState, useTransition, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/ui/link-button";
import { MonthGrid, monthBox, monthChoice } from "@/components/ui/month-grid";
import { TextArea } from "@/components/ui/text-area";
import { TextInput } from "@/components/ui/text-input";
import { MONTH_PRESETS, type MonthPreset } from "@/domain/agreement";
import { useItemWords } from "@/components/shell/item-words";
import { itemText } from "@/domain/org-settings";
import { MAX_DESCRIPTION, MAX_PRESET_LINES } from "@/domain/agreement/template";
import { EMPTY_PRESET_LINE, previewBodyFromLayoutForm, type AgreementLayoutForm, type TemplateFormErrors } from "@/domain/agreement/template-form";
import { LayoutFields } from "./layout-fields";
import { MoreOptions } from "./more-options";
import { SAVE_MESSAGES, type SaveTemplateState } from "./state";
import { TemplatePreviewFrame } from "./template-preview-frame";

export type TemplateTypeOption = { code: string; name: string };

type SaveAction = (templateId: string | null, input: AgreementLayoutForm) => Promise<SaveTemplateState>;

type ViewProps = {
  /** The values shown in the fields: what the member typed, kept across a failed save. */
  values: AgreementLayoutForm;
  errors: TemplateFormErrors;
  /** The org's equipment types, by code. A code already on a line that is not here is still shown, as its code. */
  types: TemplateTypeOption[];
  title?: string;
  pending: boolean;
  /** A refusal that is not about one field (forbidden, not found, unavailable). */
  message: string | null;
  onChange?: (next: AgreementLayoutForm) => void;
  onSubmit?: (event: FormEvent<HTMLFormElement>) => void;
  /** Whether the "Fix the highlighted fields" banner shows with the messages; the live messages beside the preview go without it. */
  banner?: boolean;
};

/** The editor's fields in order: Name, Description, Term length, the document options, the layout rows, the preset lines, then Save and Cancel (block-editor AC 29; the preset and the name as agreement-templates AC 18 had them). */
export function TemplateEditorView({ values, errors, types, pending, message, onChange, onSubmit, banner = true }: ViewProps) {
  const words = useItemWords();
  const set = (patch: Partial<AgreementLayoutForm>) => onChange?.({ ...values, ...patch });
  const setLine = (index: number, patch: Partial<AgreementLayoutForm["lines"][number]>) =>
    set({ lines: values.lines.map((line, at) => (at === index ? { ...line, ...patch } : line)) });
  const toggle = <T,>(list: readonly T[], item: T) => (list.includes(item) ? list.filter((other) => other !== item) : [...list, item]);
  const invalid = Object.keys(errors).length > 0;

  return (
    <form onSubmit={onSubmit} noValidate className="flex max-w-3xl flex-col gap-5">
      {invalid && banner && (
        <p role="alert" className="rounded-control bg-attention-bg px-3 py-2 text-[13px] font-medium text-attention-fg">
          Fix the highlighted fields, then save again. Nothing you typed is lost.
        </p>
      )}

      <TextInput id="template-name" name="name" label="Name" value={values.name} onChange={(event) => set({ name: event.target.value })} error={errors.name} />
      <TextArea
        id="template-description"
        name="description"
        label="Description"
        rows={2}
        value={values.description}
        onChange={(event) => set({ description: event.target.value })}
        hint={`Up to ${MAX_DESCRIPTION} characters. Shown on the template's card.`}
        error={errors.description}
      />
      <TextInput
        id="template-term"
        name="termMonths"
        label="Term length"
        inputMode="numeric"
        placeholder="Months, for example 12"
        value={values.termMonths}
        onChange={(event) => set({ termMonths: event.target.value })}
        error={errors["preset.termMonths"]}
        className="sm:max-w-xs"
      />

      <LayoutFields value={values} onChange={(next) => set(next)} document="agreement" errors={errors} />

      <section aria-label="Preset lines" className="flex flex-col gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 className="font-display text-[18px] font-semibold tracking-tight">Preset lines</h2>
          <p className="text-[13px] text-ink-2">Copied into a new agreement as ordinary lines. A price left empty stays empty for the estimator.</p>
        </div>
        {errors["preset.lines"] && <p className="text-[12px] font-medium text-danger">{errors["preset.lines"]}</p>}
        {values.lines.map((line, index) => {
          const at = (key: string) => errors[`preset.lines.${index}.${key}`];
          const codes = [...types.map((type) => type.code), ...line.assetTypeCodes.filter((code) => !types.some((type) => type.code === code))];
          return (
            <PresetLine
              key={index}
              index={index}
              line={line}
              invalid={Object.keys(errors).some((field) => field.startsWith(`preset.lines.${index}`))}
              onRemove={() => set({ lines: values.lines.filter((_, other) => other !== index) })}
            >
              <div className="grid gap-3 md:grid-cols-[minmax(0,3fr)_minmax(0,1fr)] md:items-start">
                <TextInput
                  id={`line-${index}-description`}
                  name={`lineDescription-${index}`}
                  label="Description"
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
              <fieldset className="flex flex-col gap-1.5" aria-describedby={at("assetTypeCodes") ? `line-${index}-types-error` : undefined}>
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
                {at("assetTypeCodes") && (
                  <p id={`line-${index}-types-error`} className="text-[12px] font-medium text-danger">
                    {at("assetTypeCodes")}
                  </p>
                )}
              </fieldset>
              {errors[`preset.lines.${index}`] && <p className="text-[12px] font-medium text-danger">{errors[`preset.lines.${index}`]}</p>}
            </PresetLine>
          );
        })}
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => set({ lines: [...values.lines, { ...EMPTY_PRESET_LINE }] })} disabled={values.lines.length >= MAX_PRESET_LINES}>
            Add line
          </Button>
          {values.lines.length >= MAX_PRESET_LINES && <span className="text-[12px] text-ink-2">{`A template can have at most ${MAX_PRESET_LINES} lines.`}</span>}
        </div>
      </section>

      {errors.body && (
        <p role="alert" className="text-[13px] font-medium text-danger">
          {errors.body}
        </p>
      )}
      {message && (
        <p role="alert" className="text-[13px] font-medium text-danger">
          {message}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Saving…" : "Save template"}
        </Button>
        <LinkButton href="/templates">Cancel</LinkButton>
      </div>
    </form>
  );
}

/**
 * One preset line, folded to its description, visit-month count and price. A line that is new or has a problem starts open, and what is
 * open stays as the member leaves it (the open state is read once, so typing never closes the line under the cursor).
 */
function PresetLine({ index, line, invalid, onRemove, children }: { index: number; line: AgreementLayoutForm["lines"][number]; invalid: boolean; onRemove: () => void; children: ReactNode }) {
  const [startsOpen] = useState(() => invalid || line.description.trim() === "");
  const months = line.visitMonths.length;
  const price = line.costPerVisit.trim();
  return (
    <details open={startsOpen} className="group rounded-panel border border-hairline bg-surface">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-4 py-1.5 text-[13.5px] marker:hidden lg:min-h-10 [&::-webkit-details-marker]:hidden">
        <svg aria-hidden="true" viewBox="0 0 20 20" className="size-4 shrink-0 text-ink-2 transition-transform duration-150 group-open:rotate-90" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M7 4l6 6-6 6" />
        </svg>
        <span className="shrink-0 font-semibold text-ink">{`Line ${index + 1}`}</span>
        <span className="min-w-0 truncate text-ink-2">{line.description.trim() || "No description yet"}</span>
        <span className={`ml-auto shrink-0 text-[12px] ${invalid ? "font-semibold text-danger" : "text-ink-2"}`}>{invalid ? "Needs attention" : [`${months} ${months === 1 ? "month" : "months"}`, price ? `$${price.replace(/^\$/, "")}` : null].filter(Boolean).join(" · ")}</span>
      </summary>
      <div className="flex flex-col gap-3 border-t border-hairline p-4">
        {children}
        <div className="flex justify-end border-t border-hairline pt-3">
          <Button onClick={onRemove}>{`Remove line ${index + 1}`}</Button>
        </div>
      </div>
    </details>
  );
}

type EditorProps = {
  /** `null` for a new template. */
  templateId: string | null;
  initial: AgreementLayoutForm;
  types: TemplateTypeOption[];
  save: SaveAction;
};

/** What a row is, in order: a message keyed to a row number stops being true when this changes. */
const shapeOf = (form: AgreementLayoutForm) => form.layout.map((row) => (row.kind === "block" ? `block:${row.type}` : `section:${row.key}`)).join();

const canDrawLayout = (values: AgreementLayoutForm) => previewBodyFromLayoutForm(values).ok;

/** Holds what is typed, sends it to the save action, and keeps it on the page when the answer is a refusal. */
export function TemplateEditor({ templateId, initial, types, save }: EditorProps) {
  const [values, setValues] = useState(initial);
  const [state, setState] = useState<SaveTemplateState>({ status: "idle" });
  const [pending, start] = useTransition();

  const saveErrors = state.status === "invalid" ? state.errors : {};
  // The fields the preview cannot draw are highlighted as they are typed; the name is only required to save, so it waits for a save.
  const live = previewBodyFromLayoutForm(values);
  const errors = { ...(live.ok ? {} : live.errors), ...saveErrors };
  const message = state.status === "idle" || state.status === "invalid" ? null : SAVE_MESSAGES[state.status];

  return (
    <div className="flex flex-col gap-6 xl:grid xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] xl:items-start xl:gap-8">
      <section aria-label="Template form" className="min-w-0">
        <TemplateEditorView
          values={values}
          errors={errors}
          types={types}
          pending={pending}
          message={message}
          banner={Object.keys(saveErrors).length > 0}
          onChange={(next) => {
            // A line or a row added, removed or moved shifts the numbers the messages were written for.
            if (next.lines.length !== values.lines.length || shapeOf(next) !== shapeOf(values)) setState({ status: "idle" });
            setValues(next);
          }}
          onSubmit={(event) => {
            event.preventDefault();
            start(async () => {
              setState(await save(templateId, values));
            });
          }}
        />
      </section>
      <TemplatePreviewFrame values={values} canDraw={canDrawLayout} />
    </div>
  );
}
