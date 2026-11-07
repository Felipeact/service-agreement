import { describe, expect, test } from "vitest";
import { firstNameFromEmail, greetingFor, greetingLine } from "./greeting";

// The time zone is passed as UTC so the cases do not depend on the zone's daylight-saving rules.
describe("greetingFor", () => {
  test.each([
    ["2027-12-01T09:00:00Z", "Good morning"],
    ["2027-12-01T11:59:00Z", "Good morning"],
    ["2027-12-01T12:00:00Z", "Good afternoon"],
    ["2027-12-01T16:59:00Z", "Good afternoon"],
    ["2027-12-01T17:00:00Z", "Good evening"],
    ["2027-12-01T00:00:00Z", "Good morning"],
  ])("%s is %s", (iso, expected) => {
    expect(greetingFor(new Date(iso), "UTC")).toBe(expected);
  });
});

describe("firstNameFromEmail", () => {
  test.each([
    ["jamie.walsh@northstar.example", "Jamie"],
    ["JAMIE_WALSH@x.com", "Jamie"],
    ["sam+work@x.com", "Sam"],
    ["priya@x.com", "Priya"],
    ["alex99@x.com", "Alex"],
  ])("%s gives %s", (email, name) => {
    expect(firstNameFromEmail(email)).toBe(name);
  });

  test.each(["felipetiburcioviana@gmail.com", "x@y.com", "123@y.com", "", "not-an-email"])("%j gives no name", (email) => {
    expect(firstNameFromEmail(email)).toBeNull();
  });
});

describe("greetingLine", () => {
  test("adds the name when there is one", () => {
    expect(greetingLine(new Date("2027-12-01T09:00:00Z"), "jamie.walsh@x.com", "UTC")).toBe("Good morning, Jamie");
  });

  test("stays plain when the email holds no name", () => {
    expect(greetingLine(new Date("2027-12-01T09:00:00Z"), "felipetiburcioviana@gmail.com", "UTC")).toBe("Good morning");
  });
});
