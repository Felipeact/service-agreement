import type { ImportParser } from "@/application/ports";
import { readDocx } from "./docx";
import { readCsv, readXlsx } from "./spreadsheet";

const ZIP = [0x50, 0x4b, 0x03, 0x04];
/** An OLE compound file: an encrypted .xlsx/.docx, or a legacy .xls/.doc renamed. */
const CFB = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];

const startsWith = (bytes: Uint8Array, signature: number[]) => signature.every((byte, i) => bytes[i] === byte);

const PDF_MARK = new TextEncoder().encode("%PDF-");

/** `%PDF-` must lie wholly within the first 1,024 bytes, as readers tolerate leading junk that far. */
function hasPdfMark(bytes: Uint8Array): boolean {
  for (let i = 0; i + PDF_MARK.length <= Math.min(bytes.length, 1024); i++) {
    if (PDF_MARK.every((byte, j) => bytes[i + j] === byte)) return true;
  }
  return false;
}

/** Office files are zips; checking the signature first keeps a password-protected file from reading as damaged. */
function officeGate(bytes: Uint8Array) {
  if (startsWith(bytes, CFB)) return { ok: false, reason: "password_protected" } as const;
  if (!startsWith(bytes, ZIP)) return { ok: false, reason: "corrupt" } as const;
  return null;
}

/** The import parser (import-parse door 3): SheetJS for spreadsheets and CSV, mammoth for Word, PDFs passed on whole. */
export const importParser: ImportParser = {
  async parse(contentType, bytes) {
    switch (contentType) {
      case "text/csv":
        return readCsv(bytes);
      case "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
        return officeGate(bytes) ?? readXlsx(bytes);
      case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        return officeGate(bytes) ?? readDocx(bytes);
      case "application/pdf":
        return hasPdfMark(bytes) ? { ok: true, parsed: { format: "pdf", bytes } } : { ok: false, reason: "corrupt" };
    }
  },
};
