"use client";

import { useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/ui/link-button";
import { MonthGrid, monthBox, monthChoice } from "@/components/ui/month-grid";
import { TextArea } from "@/components/ui/text-area";
import { TextInput } from "@/components/ui/text-input";
import { MONTH_PRESETS, type MonthPreset } from "@/domain/agreement";
import { useItemWords } from "@/components/shell/item-words";
import { itemText } from "@/domain/org-settings";
import { MAX_DESCRIPTION, MAX_PRESET_LINES } from "@/domain/agreement/template";
import { EMPTY_PRESET_LINE, type TemplateFormErrors, type TemplateFormInput } from "@/domain/agreement/template-form";
import { TEMPLATE_MESSAGES, type SaveTemplateState } from "./state";

export type TemplateTypeOption = { code: string; name: string };

type SaveAction = (templateId: string | null, input: TemplateFormInput) => Promise<SaveTemplateState>;

const TEXT_HINT = "Start a line with # for a heading and with - for a clause. Any other line is a paragraph. You can use merge variables such as {{customer.name}}.";

/** A labelled on/off switch: a checkbox with the switch role, 44px tall below desktop. */
function Switch({ id, label, hint, checked, onChange, error }: { id: string; label: string; hint: string; checked: boolean; onChange: (next: boolean) => void; error?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="flex min-h-11 cursor-pointer items-center gap-3 lg:min-h-9">
        <input id={id} type="checkbox" role="switch" checked={checked} onChange={(event) => onChange(event.target.checked)} className="size-4 shrink-0 accent-action" />
        <span className="flex flex-col">
          <span className="text-[13px] font-medium text-ink">{label}</span>
          <span className="text-[12px] text-ink-2">{hint}</span>
        </span>
      </label>
      {error && <p className="text-[12px] font-medium text-danger">{error}</p>}
    </div>
  );
}

type ViewProps = {
  /** The values shown in the fields: what the member typed, kept across a failed save. */
  values: TemplateFormInput;
  errors: TemplateFormErrors;
  /** The org's equipment types, by code. A code already on a line that is not here is still shown, as its code. */
  types: TemplateTypeOption[];
  title?: string;
  pending: boolean;
  /** A refusal that is not about one field (forbidden, not found, unavailable). */
  message: string | null;
  onChange?: (next: TemplateFormInput) => void;
  onSubmit?: (event: FormEvent<HTMLFormElement>) => void;
};

/** The editor's fields in order: Name, Description, Intro, Visit schedule, Scope, Closing text, Term length, Preset lines, then Save and Cancel (agreement-templates AC 18). */
export function TemplateEditorView({ values, errors, types, pending, message, onChange, onSubmit }: ViewProps) {
  const words = useItemWords();
  const set = (patch: Partial<TemplateFormInput>) => onChange?.({ ...values, ...patch });
  const setLine = (index: number, patch: Partial<TemplateFormInput["lines"][number]>) =>
    set({ lines: values.lines.map((line, at) => (at === index ? { ...line, ...patch } : line)) });
  const toggle = <T,>(list: readonly T[], item: T) => (list.includes(item) ? list.filter((other) => other !== item) : [...list, item]);
  const invalid = Object.keys(errors).length > 0;

  return (
    <form onSubmit={onSubmit} noValidate className="flex max-w-3xl flex-col gap-5">
      {invalid && (
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
      <TextArea
        id="template-intro"
        name="intro"
        label="Intro"
        hint={`Printed after the title block and before the price table. ${TEXT_HINT}`}
        value={values.intro}
        onChange={(event) => set({ intro: event.target.value })}
        error={errors.intro}
      />

      <fieldset className="flex flex-col gap-1">
        <legend className="sr-only">Optional sections</legend>
        <Switch id="template-schedule" label="Visit schedule" hint="Show the visit schedule on the agreement." checked={values.schedule} onChange={(schedule) => set({ schedule })} error={errors.sections} />
        <Switch id="template-scope" label="Scope" hint={itemText("Show the service included, by equipment type.", words)} checked={values.scope} onChange={(scope) => set({ scope })} />
      </fieldset>

      <TextArea
        id="template-footer"
        name="footer"
        label="Closing text"
        hint={`Printed after the terms and before the page footer. ${TEXT_HINT}`}
        value={values.footer}
        onChange={(event) => set({ footer: event.target.value })}
        error={errors.footer}
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
            <fieldset key={index} className="flex flex-col gap-3 rounded-panel border border-hairline bg-surface p-4 shadow-card">
              <legend className="px-1 text-[13px] font-semibold text-ink">{`Line ${index + 1}`}</legend>
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
              <div>
                <Button onClick={() => set({ lines: values.lines.filter((_, other) => other !== index) })}>{`Remove line ${index + 1}`}</Button>
              </div>
            </fieldset>
          );
        })}
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => set({ lines: [...values.lines, { ...EMPTY_PRESET_LINE }] })} disabled={values.lines.length >= MAX_PRESET_LINES}>
            Add line
          </Button>
          {values.lines.length >= MAX_PRESET_LINES && <span className="text-[12px] text-ink-2">{`A template can have at most ${MAX_PRESET_LINES} lines.`}</span>}
        </div>
      </section>

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

type EditorProps = {
  /** `null` for a new template. */
  templateId: string | null;
  initial: TemplateFormInput;
  types: TemplateTypeOption[];
  save: SaveAction;
};

/** Holds what is typed, sends it to the save action, and keeps it on the page when the answer is a refusal. */
export function TemplateEditor({ templateId, initial, types, save }: EditorProps) {
  const [values, setValues] = useState(initial);
  const [state, setState] = useState<SaveTemplateState>({ status: "idle" });
  const [pending, start] = useTransition();

  const errors = state.status === "invalid" ? state.errors : {};
  const message = state.status === "idle" || state.status === "invalid" ? null : TEMPLATE_MESSAGES[state.status];

  return (
    <TemplateEditorView
      values={values}
      errors={errors}
      types={types}
      pending={pending}
      message={message}
      onChange={(next) => {
        // A line removed or added moves the line numbers the messages were written for.
        if (next.lines.length !== values.lines.length) setState({ status: "idle" });
        setValues(next);
      }}
      onSubmit={(event) => {
        event.preventDefault();
        start(async () => {
          setState(await save(templateId, values));
        });
      }}
    />
  );
}
