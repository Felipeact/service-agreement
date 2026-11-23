import { describe, expect, test } from "vitest";
import { initialsOf } from "./initials";

describe("initialsOf", () => {
  test.each([
    ["Maple Court Plaza", "MC"],
    ["service pacts", "SP"],
    ["Cooper", "CO"],
    ["jamie.lee@example.ca", "JL"],
    ["alex@example.ca", "AL"],
    ["  Ångström   Heating ", "ÅH"],
    ["", "?"],
    ["@example.ca", "?"],
  ])("%j gives %j", (text, expected) => {
    expect(initialsOf(text)).toBe(expected);
  });
});
