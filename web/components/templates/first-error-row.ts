/** The lowest row number a validator's messages name (`layout.<row>...`), or `null` when none is about a row. */
export function firstErrorRow(errors: Record<string, string>): number | null {
  let first: number | null = null;
  for (const field of Object.keys(errors)) {
    const match = /^layout\.(\d+)(?:\.|$)/.exec(field);
    if (!match) continue;
    const row = Number(match[1]);
    if (first === null || row < first) first = row;
  }
  return first;
}
