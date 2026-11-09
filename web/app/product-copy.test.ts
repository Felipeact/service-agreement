import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const source = (file: string) => readFileSync(path.join(__dirname, file), "utf8");

describe("the product's own copy, outside the org's item words", () => {
  test("C2022: the login page and the root layout still say what they said (roadmap Phase 4.5 item 6 changes them, not this feature)", () => {
    const login = source("login/page.tsx");
    expect(login).toContain("Maintenance agreements for service contractors, from equipment list to signature.");
    expect(login).toContain("From equipment list to signed agreement.");
    expect(source("layout.tsx")).toContain("Preventive-maintenance service agreements for HVAC and mechanical contractors.");
  });
});
