/** A non-negative safe integer number of cents. Made only by `cents()`. */
export type Cents = number & { readonly __brand: "Cents" };

/** Throws `RangeError` unless `n` is a non-negative safe integer. */
export function cents(n: number): Cents {
  if (!Number.isSafeInteger(n) || n < 0) {
    throw new RangeError(`Cents must be a non-negative safe integer, got ${n}`);
  }
  return n as Cents;
}

/** Visits per year × cost per visit. */
export function lineAnnualCents(visitsPerYear: number, costPerVisit: Cents): Cents {
  if (!Number.isInteger(visitsPerYear) || visitsPerYear < 1) {
    throw new RangeError(`Visits per year must be an integer of at least 1, got ${visitsPerYear}`);
  }
  return cents(visitsPerYear * costPerVisit);
}

export function sumCents(amounts: readonly Cents[]): Cents {
  return cents(amounts.reduce((total, amount) => total + amount, 0));
}
