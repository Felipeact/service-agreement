import { describe, expect, test } from "vitest";
import { isId, readFields, readPostedFields } from "./server-input";

const form = (entries: Record<string, string | Blob>) => {
  const data = new FormData();
  for (const [name, value] of Object.entries(entries)) data.append(name, value);
  return data;
};

describe("isId", () => {
  test.each(["11111111-1111-4111-8111-111111111111", "0E977AC7-EF21-438B-9E05-3931C2257519"])("accepts %s", (value) => expect(isId(value)).toBe(true));
  test.each(["", "c1", "11111111-1111-4111-8111-11111111111", "11111111-1111-4111-8111-11111111111z", undefined, 7, null])("refuses %j", (value) => expect(isId(value)).toBe(false));
});

describe("readFields", () => {
  test("reads the named fields as strings and nothing else", () => {
    expect(readFields(form({ name: "Acme", orgId: "someone-elses" }), ["name"])).toEqual({ name: "Acme" });
  });

  test("a field not posted, or posted as a file, reads as the empty string", () => {
    expect(readFields(form({ file: new Blob(["x"]) }), ["name", "file"])).toEqual({ name: "", file: "" });
  });
});

describe("readPostedFields", () => {
  test("leaves out a field the form did not post, so a stored value is left alone", () => {
    expect(readPostedFields(form({ billingContactId: "" }), ["billingContactId", "approverContactId"])).toEqual({ billingContactId: "" });
    expect(readPostedFields(form({}), ["billingContactId"])).toEqual({});
  });
});
