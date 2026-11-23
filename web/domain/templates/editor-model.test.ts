import { describe, expect, test } from "vitest";
import { newBlockRow, newSectionRow, type LayoutRow } from "../agreement/layout-form";
import { TEMPLATE_VARIABLES } from "../contract/template";
import {
  availableParts,
  dropPosition,
  insertRowAt,
  moveRowTo,
  readDragPayload,
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
const texts = (rows: LayoutRow[]) => rows.map((row) => (row.kind === "block" ? row.text : row.kind === "section" ? row.key : "table"));

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

describe("drop lines", () => {
  test("[C43] a pointer in the upper half of a block drops before it and in the lower half after it", () => {
    expect(dropPosition(2, false)).toBe(2);
    expect(dropPosition(2, true)).toBe(3);
    expect(dropPosition(0, false)).toBe(0);
  });

  test("[C43] the end of the page is the line after the last row, and an insert there goes last", () => {
    const rows = [block("a"), block("b")];
    expect(dropPosition(rows.length - 1, true)).toBe(2);
    expect(texts(insertRowAt(rows, 2, block("new")).rows)).toEqual(["a", "b", "new"]);
    expect(texts(insertRowAt(rows, 0, block("new")).rows)).toEqual(["new", "a", "b"]);
    expect(insertRowAt(rows, 1, block("new")).index).toBe(1);
  });

  test("[C43] a line beyond the list is held to its ends", () => {
    const rows = [block("a")];
    expect(texts(insertRowAt(rows, 9, block("new")).rows)).toEqual(["a", "new"]);
    expect(texts(insertRowAt(rows, -3, block("new")).rows)).toEqual(["new", "a"]);
  });
});

describe("moving a row to a drop line", () => {
  const rows = [block("a"), block("b"), block("c"), block("d")];

  test("[C46] a row dragged down lands before the line, with every other row in order", () => {
    const out = moveRowTo(rows, 0, 3);
    expect(texts(out.rows)).toEqual(["b", "c", "a", "d"]);
    expect(out.index).toBe(2);
  });

  test("[C46] a row dragged up lands at the line", () => {
    const out = moveRowTo(rows, 3, 1);
    expect(texts(out.rows)).toEqual(["a", "d", "b", "c"]);
    expect(out.index).toBe(1);
  });

  test("[C46] a row dragged to the end goes last", () => {
    expect(texts(moveRowTo(rows, 1, 4).rows)).toEqual(["a", "c", "d", "b"]);
  });

  test("[C46] a drop on either side of the row itself changes nothing", () => {
    expect(moveRowTo(rows, 2, 2).rows).toBe(rows);
    expect(moveRowTo(rows, 2, 3).rows).toBe(rows);
    expect(moveRowTo(rows, 2, 2).index).toBe(2);
  });

  test("[C46] a row that is not in the list is not moved", () => {
    expect(moveRowTo(rows, 9, 0).rows).toBe(rows);
    expect(moveRowTo(rows, -1, 0).rows).toBe(rows);
  });
});

describe("what a drop may carry", () => {
  test("[C44] a block of each type and a part of each key are read back as dropped", () => {
    for (const type of ["heading", "paragraph", "clause"] as const) expect(readDragPayload(JSON.stringify({ kind: "add", choice: { kind: "block", type } }))).toEqual({ kind: "add", choice: { kind: "block", type } });
    for (const key of ["price", "schedule", "included", "equipment", "terms", "signatures"] as const) expect(readDragPayload(JSON.stringify({ kind: "add", choice: { kind: "part", key } }))).toEqual({ kind: "add", choice: { kind: "part", key } });
  });

  test("[C46] a move is read back with its index", () => {
    expect(readDragPayload('{"kind":"move","from":3}')).toEqual({ kind: "move", from: 3 });
  });

  test("[C45] anything else is refused: other text, other shapes, unknown types and keys, bad indexes", () => {
    for (const raw of ["", "hello", "null", "[]", "{}", '{"kind":"add"}', '{"kind":"add","choice":{"kind":"block","type":"table"}}', '{"kind":"add","choice":{"kind":"part","key":"footer"}}', '{"kind":"move","from":-1}', '{"kind":"move","from":1.5}', '{"kind":"move","from":"1"}', '{"kind":"delete","from":1}']) {
      expect(readDragPayload(raw), raw).toBeNull();
    }
  });
});
