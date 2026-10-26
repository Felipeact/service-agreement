import { describe, expect, test } from "vitest";
import { contentTypeFor, formatFileSize, IMPORT_MESSAGES, validateImportFile } from ".";

const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

describe("contentTypeFor", () => {
  test.each([
    ["pdf", "application/pdf"],
    ["csv", "text/csv"],
    ["xlsx", XLSX],
    ["docx", DOCX],
    ["PDF", "application/pdf"],
    ["Csv", "text/csv"],
    ["XLSX", XLSX],
    ["DocX", DOCX],
    ["xls", null],
    ["doc", null],
    ["txt", null],
    ["", null],
  ])("C407: %j -> %j", (extension, expected) => {
    expect(contentTypeFor(extension)).toBe(expected);
  });
});

describe("validateImportFile", () => {
  test.each([
    ["report.txt", 100, IMPORT_MESSAGES.extension],
    ["noext", 100, IMPORT_MESSAGES.extension],
    ["empty.csv", 0, IMPORT_MESSAGES.empty],
    ["big.pdf", 20_971_521, IMPORT_MESSAGES.tooLarge],
    [`${"n".repeat(252)}.csv`, 100, IMPORT_MESSAGES.nameTooLong],
  ])("C411: %s of %d bytes is refused", (name, size, message) => {
    expect(name.length <= 256).toBe(true);
    expect(validateImportFile({ name, size })).toEqual({ ok: false, message });
  });

  test("C411: the messages are the plan's exact copy", () => {
    expect(IMPORT_MESSAGES).toEqual({
      extension: "Choose an Excel (.xlsx), CSV, Word (.docx) or PDF file",
      empty: "This file is empty",
      tooLarge: "Files can be up to 20 MB",
      nameTooLong: "File name must be 255 characters or fewer",
    });
  });

  test.each([
    ["one.csv", 1, "text/csv"],
    ["max.pdf", 20_971_520, "application/pdf"],
    [`${"n".repeat(251)}.pdf`, 100, "application/pdf"],
    ["LIST.XLSX", 100, XLSX],
  ])("C411: %s of %d bytes is accepted", (name, size, contentType) => {
    expect(validateImportFile({ name, size })).toEqual({ ok: true, value: { name, size, contentType } });
  });

  test("C411: the boundary names are 256 and 255 characters", () => {
    expect(`${"n".repeat(252)}.csv`).toHaveLength(256);
    expect(`${"n".repeat(251)}.pdf`).toHaveLength(255);
  });
});

describe("formatFileSize", () => {
  test.each([
    [512, "1 KB"],
    [15_360, "15 KB"],
    [1_048_576, "1.0 MB"],
    [20_971_520, "20.0 MB"],
  ])("C418: %d bytes -> %s", (bytes, expected) => {
    expect(formatFileSize(bytes)).toBe(expected);
  });
});
