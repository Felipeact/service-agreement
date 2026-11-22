"use client";

import { MAX_CELL, TABLE_MAX_COLUMNS, TABLE_MAX_ROWS } from "@/domain/agreement/layout";
import type { TableRow } from "@/domain/agreement/layout-form";

const TOOL =
  "inline-flex min-h-11 items-center justify-center rounded-control border border-hairline bg-surface px-3 text-[12px] font-semibold text-ink-nav transition-colors hover:border-line-strong hover:bg-ground disabled:cursor-not-allowed disabled:opacity-50 lg:min-h-8";

/** A table at rest on the page: the header row in bold over a rule, the cells as typed. A cell that is a merge variable shows its own text. */
export function TablePreview({ row }: { row: TableRow }) {
  const head = row.header ? row.rows[0] : undefined;
  const body = row.header ? row.rows.slice(1) : row.rows;
  return (
    <div className="relative overflow-x-auto">
      <table className="w-full min-w-[280px] border-collapse text-left text-[13px]">
        {head && (
          <thead>
            <tr className="border-b-2 border-action">
              {head.map((cell, column) => (
                <th key={column} scope="col" className="px-2 py-1.5 font-semibold text-action-press">
                  {cell.trim() === "" ? <span className="font-normal text-ink-2">Heading</span> : cell}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody className="divide-y divide-hairline">
          {body.map((cells, index) => (
            <tr key={index}>
              {cells.map((cell, column) => (
                <td key={column} className="px-2 py-1.5 align-top break-words">
                  {cell.trim() === "" ? <span className="text-ink-2">Empty</span> : cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * The selected table: a grid of text fields you type into, with buttons to add or remove a row or a column, and whether the first
 * row is a header. Limits come from the layout's own rules, so a table that fits here is one the validator accepts.
 */
export function TableEditor({ row, onChange, id }: { row: TableRow; onChange: (patch: Partial<TableRow>) => void; id: string }) {
  const width = row.rows[0]?.length ?? 0;
  const setCell = (r: number, c: number, value: string) => onChange({ rows: row.rows.map((cells, at) => (at === r ? cells.map((cell, column) => (column === c ? value : cell)) : cells)) });
  return (
    <div className="flex flex-col gap-3">
      <div className="relative overflow-x-auto">
        <table className="w-full min-w-[320px] border-separate border-spacing-1">
          <tbody>
            {row.rows.map((cells, r) => (
              <tr key={r}>
                {cells.map((cell, c) => {
                  const heading = row.header && r === 0;
                  return (
                    <td key={c} className="min-w-28 align-top">
                      <input
                        id={`${id}-${r}-${c}`}
                        aria-label={`${heading ? "Heading" : `Row ${r + (row.header ? 0 : 1)}`}, column ${c + 1}`}
                        value={cell}
                        maxLength={MAX_CELL}
                        onChange={(event) => setCell(r, c, event.target.value)}
                        className={`h-11 w-full rounded-control border border-field bg-surface px-2 text-[13px] text-ink lg:h-9 ${heading ? "bg-action-tint font-semibold text-action-press" : ""}`}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div role="group" aria-label="Table tools" className="flex flex-wrap items-center gap-1.5">
        <button type="button" className={TOOL} disabled={row.rows.length >= TABLE_MAX_ROWS} onClick={() => onChange({ rows: [...row.rows, Array.from({ length: width }, () => "")] })}>
          Add row
        </button>
        <button type="button" className={TOOL} disabled={row.rows.length <= 1} onClick={() => onChange({ rows: row.rows.slice(0, -1) })}>
          Remove row
        </button>
        <button type="button" className={TOOL} disabled={width >= TABLE_MAX_COLUMNS} onClick={() => onChange({ rows: row.rows.map((cells) => [...cells, ""]) })}>
          Add column
        </button>
        <button type="button" className={TOOL} disabled={width <= 1} onClick={() => onChange({ rows: row.rows.map((cells) => cells.slice(0, -1)) })}>
          Remove column
        </button>
        <label className="ml-auto inline-flex min-h-11 items-center gap-2 text-[13px] font-medium lg:min-h-8">
          <input type="checkbox" checked={row.header} onChange={(event) => onChange({ header: event.target.checked })} className="size-4 accent-[var(--color-action)]" />
          First row is a heading
        </label>
      </div>
    </div>
  );
}
