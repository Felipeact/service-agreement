/** The class strings of the approved agreement-page design (the /concepts/agreement preview, 2026-11-23), shared by its parts. */
export const panel = "rounded-panel border border-hairline bg-surface shadow-card";
export const secondaryButton =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-control border border-hairline bg-surface px-3.5 text-[14px] font-semibold hover:bg-board disabled:cursor-not-allowed disabled:opacity-60 lg:min-h-9";
export const primaryButton =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-control bg-action px-4 text-[14px] font-semibold text-surface hover:bg-action-hover disabled:cursor-not-allowed disabled:bg-board disabled:text-ink-2 lg:min-h-9";
export const linkButton = "inline-flex min-h-11 items-center text-[14px] font-semibold text-action hover:underline lg:min-h-8";
export const field = "min-h-11 rounded-control border border-hairline bg-surface px-3 text-[14px] focus:border-action focus:outline-none lg:min-h-9";

/** "Mar, Jun, Sep, Dec" or "Every month". */
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const monthsText = (months: readonly number[]) => (months.length === 12 ? "Every month" : months.map((month) => MONTHS[month - 1]).join(", "));

/** "$3,690" for whole dollars, "$3,690.50" otherwise. */
export function money(cents: number): string {
  const exact = cents % 100 !== 0;
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", currencyDisplay: "narrowSymbol", minimumFractionDigits: exact ? 2 : 0, maximumFractionDigits: exact ? 2 : 0 }).format(cents / 100);
}

export const units = (count: number) => `${count} ${count === 1 ? "unit" : "units"}`;
