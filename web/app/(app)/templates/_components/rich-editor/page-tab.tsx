"use client";

import type { ReactNode } from "react";
import { RotateCcw } from "lucide-react";
import { THEME_ACCENTS, THEME_ACCENT_KEYS, type DocOptions, type PageFooter, type ThemeAccent, type ThemeFont } from "@/domain/agreement/layout";
import { Group } from "./ribbon";

/** A choice in the Page tab: a sketch of the page over its name, pressed when it is the page's setting. 44px and more by touch. */
function Choice({ pressed, onClick, label, disabled, children }: { pressed: boolean; onClick: () => void; label: string; disabled?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className="flex min-h-14 min-w-[4.5rem] shrink-0 flex-col items-center justify-center gap-1 rounded-control border border-transparent px-2 py-1.5 text-[12px] font-medium text-ink hover:bg-surface aria-pressed:border-action aria-pressed:bg-surface aria-pressed:text-action aria-pressed:shadow-card disabled:opacity-40"
    >
      {children}
      <span className="leading-tight">{label}</span>
    </button>
  );
}

/** A small page: where the header, the lines under the title and the footer sit, drawn as bars. */
function Sketch({ header = false, meta = false, footer, accent = "bg-ink-2" }: { header?: boolean; meta?: boolean; footer?: PageFooter; accent?: string }) {
  const bar = "block h-[3px] rounded-full";
  return (
    <span aria-hidden="true" className="relative flex h-10 w-8 flex-col gap-[3px] rounded-[3px] border border-line-strong bg-surface p-[4px]">
      {header && <span className={`${bar} w-full ${accent}`} />}
      {meta && <span className={`${bar} w-3/4 bg-action`} />}
      <span className={`${bar} w-full bg-board`} />
      <span className={`${bar} w-2/3 bg-board`} />
      {footer && <span className={`${bar} mt-auto ${footer === "number" ? "ml-auto w-1/3" : "w-full"} bg-ink-2`} />}
    </span>
  );
}

const FONT_NAMES: Record<ThemeFont, { label: string; face: string }> = { sans: { label: "Clean", face: "font-sans" }, serif: { label: "Classic", face: "font-serif" } };

type Props = {
  doc: DocOptions;
  onDoc: (doc: DocOptions) => void;
  hasHeader: boolean;
  onHeader: (on: boolean) => void;
  onResetHeader: () => void;
  /** The company's own colour, offered first. */
  companyAccent: string;
};

/**
 * The Page tab: everything about the page as a whole, as pictures rather than form fields. Whether there is a header and where it prints,
 * the colour, the type, the lines under the title and the footer; each a set of tiles, the page's current choice pressed.
 */
export function PageTab({ doc, onDoc, hasHeader, onHeader, onResetHeader, companyAccent }: Props) {
  const theme = doc.theme ?? {};
  const setTheme = (patch: { accent?: ThemeAccent; font?: ThemeFont }) => {
    const next = { ...theme, ...patch };
    if (next.accent === undefined) delete next.accent;
    if (next.font === undefined || next.font === "sans") delete next.font;
    const rest = { ...doc };
    delete rest.theme;
    onDoc(Object.keys(next).length > 0 ? { ...rest, theme: next } : rest);
  };
  const every = doc.pageHeader === "every";
  return (
    <>
      <Group name="Header">
        <Choice label="Header" pressed={hasHeader} onClick={() => onHeader(true)}>
          <Sketch header accent="bg-action" />
        </Choice>
        <Choice label="No header" pressed={!hasHeader} onClick={() => onHeader(false)}>
          <Sketch />
        </Choice>
        <span aria-hidden="true" className="mx-1 h-10 w-px bg-hairline" />
        <Choice label="First page" pressed={hasHeader && !every} disabled={!hasHeader} onClick={() => onDoc({ ...doc, pageHeader: "first" })}>
          <Sketch header accent="bg-action" />
        </Choice>
        <Choice label="Every page" pressed={hasHeader && every} disabled={!hasHeader} onClick={() => onDoc({ ...doc, pageHeader: "every" })}>
          <span aria-hidden="true" className="relative block pr-1.5 pb-1">
            <span className="absolute top-1 left-1.5 h-10 w-8 rounded-[3px] border border-line-strong bg-board" />
            <span className="relative block">
              <Sketch header accent="bg-action" />
            </span>
          </span>
        </Choice>
        <button
          type="button"
          onClick={onResetHeader}
          disabled={!hasHeader}
          className="flex min-h-14 min-w-[4.5rem] shrink-0 flex-col items-center justify-center gap-1 rounded-control px-2 text-[12px] font-medium text-ink-2 hover:bg-surface hover:text-ink disabled:opacity-40"
        >
          <RotateCcw className="size-5" aria-hidden="true" />
          Standard
        </button>
      </Group>

      <Group name="Colour">
        <div role="radiogroup" aria-label="Colour" className="grid grid-cols-4 gap-1.5 px-1 sm:grid-cols-7">
          {([undefined, ...THEME_ACCENT_KEYS] as (ThemeAccent | undefined)[]).map((key) => {
            const colour = key ? THEME_ACCENTS[key] : companyAccent;
            const chosen = theme.accent === key;
            return (
              <button
                key={key ?? "company"}
                type="button"
                role="radio"
                aria-checked={chosen}
                aria-label={key ? `${key[0].toUpperCase()}${key.slice(1)}` : "Company colour"}
                title={key ? `${key[0].toUpperCase()}${key.slice(1)}` : "Company colour"}
                onClick={() => setTheme({ accent: key })}
                className="relative flex size-11 items-center justify-center rounded-full ring-offset-2 ring-offset-board aria-checked:ring-2 aria-checked:ring-ink lg:size-8"
                style={{ backgroundColor: colour }}
              >
                {!key && <span className="text-[10px] font-bold text-surface">Co</span>}
              </button>
            );
          })}
        </div>
      </Group>

      <Group name="Type">
        {(["sans", "serif"] as const).map((font) => (
          <Choice key={font} label={FONT_NAMES[font].label} pressed={(theme.font ?? "sans") === font} onClick={() => setTheme({ font })}>
            <span aria-hidden="true" className={`text-[20px] leading-none font-semibold ${FONT_NAMES[font].face}`}>
              Aa
            </span>
          </Choice>
        ))}
      </Group>

      <Group name="Under the title">
        <Choice label="Number and customer" pressed={doc.showMeta} onClick={() => onDoc({ ...doc, showMeta: !doc.showMeta })}>
          <Sketch meta />
        </Choice>
      </Group>

      <Group name="Footer">
        <Choice label="Page numbers" pressed={doc.pageFooter === "number"} onClick={() => onDoc({ ...doc, pageFooter: "number" })}>
          <Sketch footer="number" />
        </Choice>
        <Choice label="Company details" pressed={doc.pageFooter === "letterhead"} onClick={() => onDoc({ ...doc, pageFooter: "letterhead" })}>
          <Sketch footer="letterhead" />
        </Choice>
      </Group>
    </>
  );
}
