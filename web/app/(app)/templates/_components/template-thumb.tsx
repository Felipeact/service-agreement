import { layoutOf, type AgreementTemplateBody, type LayoutItem, type ThemeAccent } from "@/domain/agreement";

/** The template's own colour as classes, so the thumbnail wears it without an inline style. The company's colour stands in as blue. */
const ACCENT_BAR: Record<ThemeAccent | "company", string> = {
  company: "bg-action",
  blue: "bg-blue-600",
  teal: "bg-teal-700",
  amber: "bg-amber-700",
  violet: "bg-violet-700",
  rose: "bg-rose-700",
  slate: "bg-slate-700",
};

const MAX_ITEMS = 6;

/** A grey line whose length follows the text it stands for. */
function Lines({ text, align }: { text: string; align?: "left" | "center" | "right" }) {
  const count = text.length > 140 ? 3 : text.length > 50 ? 2 : 1;
  const justify = align === "center" ? "items-center" : align === "right" ? "items-end" : "items-start";
  return (
    <div className={`flex flex-col gap-[3px] ${justify}`}>
      {Array.from({ length: count }, (_, at) => (
        <span key={at} className={`h-[3px] rounded-full bg-line-strong ${at === count - 1 && count > 1 ? "w-2/3" : "w-full"}`} />
      ))}
    </div>
  );
}

function Item({ item, accent }: { item: LayoutItem; accent: string }) {
  if (item.kind === "table") {
    const columns = item.rows[0]?.length ?? 1;
    return (
      <div className="flex flex-col gap-[2px]">
        {item.rows.slice(0, 3).map((row, at) => (
          <div key={at} className="flex gap-[2px]">
            {Array.from({ length: columns }, (_, column) => (
              <span key={column} className={`h-[5px] flex-1 rounded-[1px] ${item.header && at === 0 ? accent : "bg-board"}`} />
            ))}
          </div>
        ))}
      </div>
    );
  }
  if (item.kind === "block") {
    if (item.type === "heading") return <span className={`h-[5px] rounded-full ${accent} ${item.level === 1 ? "w-3/5" : "w-2/5"} ${item.style?.align === "center" ? "self-center" : item.style?.align === "right" ? "self-end" : ""}`} />;
    return <Lines text={item.text} align={item.style?.align} />;
  }
  switch (item.key) {
    case "price":
      return (
        <div className="flex flex-col gap-[3px]">
          {[0, 1].map((row) => (
            <div key={row} className="flex items-center justify-between gap-2 border-b border-hairline pb-[2px]">
              <span className="h-[3px] w-1/2 rounded-full bg-line-strong" />
              <span className="h-[3px] w-1/6 rounded-full bg-ink-2" />
            </div>
          ))}
        </div>
      );
    case "schedule":
      return (
        <div className="flex gap-[2px]">
          {Array.from({ length: 12 }, (_, month) => (
            <span key={month} className={`h-[5px] flex-1 rounded-[1px] ${month % 3 === 2 ? accent : "bg-board"}`} />
          ))}
        </div>
      );
    case "signatures":
      return (
        <div className="flex gap-3 pt-1">
          <span className="h-px flex-1 bg-ink-2" />
          <span className="h-px flex-1 bg-ink-2" />
        </div>
      );
    default:
      return <Lines text={"x".repeat(60)} />;
  }
}

/**
 * A small drawing of the page a template makes: the title in the template's colour, then each block as the kind of mark it
 * leaves (a heading bar, lines of text, a table grid, price rows, the twelve visit months). It is drawn from the template itself,
 * so a change in the editor shows here without anyone drawing a picture.
 */
export function TemplateThumb({ body }: { body: AgreementTemplateBody }) {
  const { doc, layout } = layoutOf(body);
  const accent = ACCENT_BAR[doc.theme?.accent ?? "company"];
  const shown = layout.slice(0, MAX_ITEMS);
  return (
    <div aria-hidden="true" data-template-thumb className="flex h-36 flex-col gap-2.5 overflow-hidden rounded-card border border-hairline bg-ground p-3.5 shadow-inner">
      <span className={`h-[3px] w-full rounded-full ${accent}`} />
      <span className="h-[6px] w-3/4 rounded-full bg-ink" />
      <div className="flex flex-col gap-2">
        {shown.map((item, at) => (
          <Item key={at} item={item} accent={accent} />
        ))}
      </div>
    </div>
  );
}
