import { inflateSync } from "node:zlib";

/**
 * Text of each page of a PDF this adapter wrote, one string per page, one line per run of words.
 * Helvetica is a standard font, so its text sits in the page's content stream as WinAnsi hex strings.
 */
export function pdfPages(bytes: Uint8Array): string[] {
  const raw = Buffer.from(bytes).toString("latin1");
  const pages: string[] = [];
  for (const match of raw.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
    let content: string;
    try {
      content = inflateSync(Buffer.from(match[1], "latin1")).toString("latin1");
    } catch {
      continue;
    }
    if (!/\bBT\b/.test(content)) continue;
    const lines: string[] = [];
    for (const op of content.matchAll(/\[([^\]]*)\]\s*TJ|<([0-9a-fA-F]*)>\s*Tj/g)) {
      const hexes = op[1] !== undefined ? [...op[1].matchAll(/<([0-9a-fA-F]*)>/g)].map((m) => m[1]) : [op[2]];
      const piece = hexes.map((hex) => Buffer.from(hex, "hex").toString("latin1")).join("");
      // A word followed by its space is one line of text drawn in several operators.
      if (lines.length > 0 && lines[lines.length - 1].endsWith(" ")) lines[lines.length - 1] += piece;
      else lines.push(piece);
    }
    pages.push(lines.join("\n"));
  }
  return pages;
}

/** The colour operators (`r g b scn` fill, `r g b SCN` stroke) of every page, as "#rrggbb" strings. */
export function pdfColours(bytes: Uint8Array, operator: "scn" | "SCN" | "any" = "any"): Set<string> {
  const raw = Buffer.from(bytes).toString("latin1");
  const colours = new Set<string>();
  for (const match of raw.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
    let content: string;
    try {
      content = inflateSync(Buffer.from(match[1], "latin1")).toString("latin1");
    } catch {
      continue;
    }
    for (const op of content.matchAll(/([\d.]+) ([\d.]+) ([\d.]+) (scn|SCN)\b/g)) {
      if (operator !== "any" && op[4] !== operator) continue;
      colours.add("#" + [op[1], op[2], op[3]].map((v) => Math.round(Number(v) * 255).toString(16).padStart(2, "0")).join(""));
    }
  }
  return colours;
}

/** WinAnsi bytes read as latin1 differ from Unicode only for 0x80-0x9F: the typographic apostrophe is 0x92, the en dash 0x96. */
export const winAnsi = (text: string) => text.replace(/’/g, "\x92").replace(/–/g, "\x96");
