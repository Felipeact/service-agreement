"use client";

import { useItemWords } from "@/components/shell/item-words";
import { PRICE_COLUMN_KEYS, type PriceColumns, type SectionKey } from "@/domain/agreement/layout";
import type { SectionRow } from "@/domain/agreement/layout-form";
import type { TemplateFormLine } from "@/domain/agreement/template-form";
import { itemText, type ItemWords } from "@/domain/org-settings";

const DEFAULT_COLUMNS: PriceColumns = { description: "Description", visits: "Visits per year", perVisit: "Per visit", perYear: "Per year", total: "Total per year" };
const MONTHS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

/** What a live section is called in the Insert panel and on the page; the equipment section takes the org's own word. */
export function sectionName(key: SectionKey, words: ItemWords): string {
  switch (key) {
    case "price":
      return "Price lines table";
    case "schedule":
      return "Visit schedule";
    case "included":
      return "Service included";
    case "equipment":
      return itemText("Equipment list", words);
    case "terms":
      return "Terms";
    case "signatures":
      return "Signatures";
  }
}

/** One line on what each live section fills in, for the Insert panel; the equipment words are the org's own. */
export function sectionHint(key: SectionKey, words: ItemWords): string {
  switch (key) {
    case "price":
      return "Each agreement's services, visits and prices, with the yearly total";
    case "schedule":
      return "Which month each visit happens";
    case "included":
      return itemText("The checklist for each equipment type", words);
    case "equipment":
      return itemText("Every unit on site, by type", words);
    case "terms":
      return "Payment, cancellation, discount and renewal terms";
    case "signatures":
      return "Where the customer and your company sign";
  }
}

/**
 * A live section as it looks while designing: its title and a sketch of what each agreement fills in. The price table shows the
 * template's preset lines when it has some.
 */
export function SectionSample({ row, lines, accent }: { row: SectionRow; lines: readonly TemplateFormLine[]; accent: string }) {
  const words = useItemWords();
  const title = row.title.trim() || sectionName(row.key, words);
  const heading = (
    <p className="rich-section-title" style={{ color: accent }}>
      {title}
    </p>
  );
  switch (row.key) {
    case "price": {
      const label = (key: keyof PriceColumns) => row.columns[key].trim() || DEFAULT_COLUMNS[key];
      return (
        <div className="flex flex-col gap-1">
          {heading}
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-left">
                {PRICE_COLUMN_KEYS.filter((key) => key !== "total").map((key) => (
                  <th key={key} className="border-b border-hairline py-[2pt] font-semibold">
                    {label(key)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lines.length > 0 ? (
                lines.map((line, index) => (
                  <tr key={index}>
                    <td className="border-b border-hairline py-[2pt]">{line.description || "New line"}</td>
                    <td className="border-b border-hairline py-[2pt]">{line.visitMonths.length}</td>
                    <td className="border-b border-hairline py-[2pt]">{line.costPerVisit || "-"}</td>
                    <td className="border-b border-hairline py-[2pt]">-</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="border-b border-hairline py-[2pt] text-ink-2" colSpan={4}>
                    Each agreement&apos;s services, visits and prices
                  </td>
                </tr>
              )}
              <tr>
                <td className="py-[2pt] text-right font-semibold" colSpan={4}>
                  {label("total")}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      );
    }
    case "schedule":
      return (
        <div className="flex flex-col gap-1">
          {heading}
          <div className="grid grid-cols-12 gap-0.5" aria-hidden="true">
            {MONTHS.map((month, index) => (
              <span key={index} className={`rounded-sm py-0.5 text-center ${[2, 5, 8, 11].includes(index) ? "bg-action text-surface" : "bg-board text-ink-2"}`}>
                {month}
              </span>
            ))}
          </div>
        </div>
      );
    case "signatures":
      return (
        <div className="flex flex-col gap-2">
          {heading}
          <div className="grid grid-cols-2 gap-4 text-ink-2" aria-hidden="true">
            <span className="border-t border-field pt-1">{row.customerLabel.trim() || "For the Customer"}</span>
            <span className="border-t border-field pt-1">{row.contractorLabel.trim() || "For your company"}</span>
          </div>
        </div>
      );
    default:
      return (
        <div className="flex flex-col gap-0.5">
          {heading}
          <p className="text-ink-2">{sectionHint(row.key, words)}</p>
        </div>
      );
  }
}
