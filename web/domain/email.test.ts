import { describe, expect, test } from "vitest";
import { isEmailAddress } from "./email";

describe("isEmailAddress", () => {
  test.each(["owner@example.com", "  Owner@Example.CA  ", "a.b+c@d.co"])("accepts %j", (value) => expect(isEmailAddress(value)).toBe(true));
  test.each(["", "owner", "owner@", "owner@example", "own er@example.com", `${"a".repeat(250)}@x.co`])("refuses %j", (value) => expect(isEmailAddress(value)).toBe(false));
});
