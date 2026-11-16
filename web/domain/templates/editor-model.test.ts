import { describe, expect, test } from "vitest";
import { newBlockRow, newSectionRow, type LayoutRow } from "../agreement/layout-form";
import { TEMPLATE_VARIABLES } from "../contract/template";
import {
  availableParts,
  canMove,
  insertRow,
  insertVariable,
  insertionIndex,
  isRequired,
  moveRow,
  partsOf,
  removeRow,
  restoreRow,
  VARIABLE_LABELS,
} from "./editor-model";

const block = (text: string): LayoutRow => ({ ...newBlockRow("paragraph"), text });
const part = (key: Parameters<typeof newSectionRow>[0]): LayoutRow => newSectionRow(key);
const texts = (rows: LayoutRow[]) => rows.map((row) => (row.kind === "block" ? row.text : row.key));

describe("required parts", () => {
  test("[C5] the price table is required in both documents and signatures only in the contract", () => {
    const agreement = partsOf("agreement").filter((key) => isRequired(part(key), "agreement"));
    const contract = partsOf("contract").filter((key) => isRequired(part(key), "contract"));
    expect(agreement).toEqual(["price"]);
    expect(contract).toEqual(["price", "signatures"]);
    // a text block is never required, whatever it says
    expect(isRequired(block("Price"), "agreement")).toBe(false);
    expect(isRequired(block("Price"), "contract")).toBe(false);
    // terms is a part of the agreement and can be removed; signatures in an agreement is not one of its parts at all
    expect(isRequired(part("terms"), "agreement")).toBe(false);
    expect(isRequired(part("signatures"), "agreement")).toBe(false);
  });
});

describe("moving a row", () => {
  const rows = [block("a"), block("b"), block("c")];

  test("[C6] the first row cannot move up and the last cannot move down", () => {
    expect(canMove(rows, 0, -1)).toBe(false);
    expect(canMove(rows, 2, 1)).toBe(false);
    expect(canMove(rows, 0, 1)).toBe(true);
    expect(canMove(rows, 2, -1)).toBe(true);
    expect(canMove(rows, 1, -1)).toBe(true);
    expect(canMove(rows, 1, 1)).toBe(true);
  });

  test("[C6] a move swaps exactly two rows and leaves the others where they were", () => {
    expect(texts(moveRow(rows, 1, -1))).toEqual(["b", "a", "c"]);
    expect(texts(moveRow(rows, 1, 1))).toEqual(["a", "c", "b"]);
    expect(texts(rows)).toEqual(["a", "b", "c"]);
  });

  test("[C6] a move with no neighbour returns the same rows", () => {
    expect(moveRow(rows, 0, -1)).toBe(rows);
    expect(moveRow(rows, 2, 1)).toBe(rows);
  });
});

describe("delete and undo", () => {
  test("[C9] removing a row takes exactly that row and remembers it with its index", () => {
    const rows = [block("a"), block("b"), block("c")];
    const out = removeRow(rows, 1);
    expect(texts(out.rows)).toEqual(["a", "c"]);
    expect(out.removed.index).toBe(1);
    expect(out.removed.row).toBe(rows[1]);
  });

  test("[C9] restoring puts the row back at its old index", () => {
    const rows = [block("a"), block("b"), block("c")];
    const { rows: after, removed } = removeRow(rows, 1);
    const back = restoreRow(after, removed);
    expect(texts(back.rows)).toEqual(["a", "b", "c"]);
    expect(back.index).toBe(1);
  });

  test("[C9] restoring into a list that got shorter puts the row at the end", () => {
    const rows = [block("a"), block("b"), block("c")];
    const { removed } = removeRow(rows, 2);
    const back = restoreRow([block("a")], removed);
    expect(texts(back.rows)).toEqual(["a", "c"]);
    expect(back.index).toBe(1);
  });
});

describe("the parts a document offers", () => {
  test("[C12] the agreement offers price, schedule, included, equipment and terms, in that order", () => {
    expect(availableParts([], "agreement").map((p) => p.key)).toEqual(["price", "schedule", "included", "equipment", "terms"]);
  });

  test("[C12] the contract offers price, schedule, included, equipment and signatures, in that order", () => {
    expect(availableParts([], "contract").map((p) => p.key)).toEqual(["price", "schedule", "included", "equipment", "signatures"]);
  });

  test("[C12] a part is on the page when a row has its key, and only then", () => {
    const rows = [block("terms"), part("price"), part("equipment")];
    const onPage = Object.fromEntries(availableParts(rows, "agreement").map((p) => [p.key, p.onPage]));
    expect(onPage).toEqual({ price: true, schedule: false, included: false, equipment: true, terms: false });
  });
});

describe("where a new row goes", () => {
  const rows = [block("a"), block("b"), block("c")];

  test("[C14] with a block selected it goes right after it, and its index is reported", () => {
    const out = insertRow(rows, 0, block("new"));
    expect(texts(out.rows)).toEqual(["a", "new", "b", "c"]);
    expect(out.index).toBe(1);
  });

  test("[C14] with the last block selected it goes at the end", () => {
    expect(texts(insertRow(rows, 2, block("new")).rows)).toEqual(["a", "b", "c", "new"]);
  });

  test("[C14] with nothing selected it goes at the end", () => {
    const out = insertRow(rows, null, block("new"));
    expect(texts(out.rows)).toEqual(["a", "b", "c", "new"]);
    expect(out.index).toBe(3);
  });

  test("[C14] with nothing selected and a final signatures part it goes before the signatures", () => {
    const contract = [part("price"), block("clause"), part("signatures")];
    const out = insertRow(contract, null, block("new"));
    expect(texts(out.rows)).toEqual(["price", "clause", "new", "signatures"]);
    expect(out.index).toBe(2);
  });

  test("[C14] with signatures selected it goes after them, because the owner chose that place", () => {
    const contract = [part("price"), part("signatures")];
    expect(texts(insertRow(contract, 1, block("new")).rows)).toEqual(["price", "signatures", "new"]);
  });

  test("[C14] an empty list takes the row at index 0, and a selection past the end is treated as none", () => {
    expect(insertionIndex([], null)).toBe(0);
    expect(insertionIndex(rows, 9)).toBe(3);
  });
});

describe("merge variables", () => {
  test("[C16] every variable on the whitelist has a plain label, and nothing else does", () => {
    expect(Object.keys(VARIABLE_LABELS).sort()).toEqual([...TEMPLATE_VARIABLES].sort());
    expect(TEMPLATE_VARIABLES).toHaveLength(16);
    for (const name of TEMPLATE_VARIABLES) expect(VARIABLE_LABELS[name].trim()).not.toBe("");
  });

  test("[C16] a variable goes at the caret", () => {
    expect(insertVariable("Dear , hello", { start: 5, end: 5 }, "customer.name")).toBe("Dear {{customer.name}}, hello");
  });

  test("[C16] a variable replaces a selection", () => {
    expect(insertVariable("Dear XXX, hello", { start: 5, end: 8 }, "customer.name")).toBe("Dear {{customer.name}}, hello");
  });

  test("[C16] a variable goes at the end when the field was never focused", () => {
    expect(insertVariable("Paid within ", null, "terms.paymentDays")).toBe("Paid within {{terms.paymentDays}}");
  });

  test("[C16] a caret outside the text is held to its ends", () => {
    expect(insertVariable("ab", { start: 99, end: 120 }, "province")).toBe("ab{{province}}");
    expect(insertVariable("ab", { start: -4, end: -1 }, "province")).toBe("{{province}}ab");
  });
});
