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

/** Formats integer cents as CAD with two decimals always ($150.00, $3,870.00), for prices on an agreement. */
export function formatCadExact(cents: number): string {
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cents / 100);
}
