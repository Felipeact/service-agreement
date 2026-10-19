/** Formats integer cents as CAD: whole dollars drop the decimals ($14,280), others keep two ($14,280.50). */
export function formatCad(cents: number): string {
  const digits = cents % 100 === 0 ? 0 : 2;
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(cents / 100);
}
