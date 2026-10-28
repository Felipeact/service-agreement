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

/** WinAnsi bytes read as latin1 differ from Unicode only for 0x80-0x9F: the typographic apostrophe is 0x92. */
export const winAnsi = (text: string) => text.replace(/’/g, "\x92");
