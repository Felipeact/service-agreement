import { describe, expectTypeOf, test } from "vitest";
import type { Database } from "./database.types";

describe("the generated types", () => {
  test("C1125: asset_type_tasks rows carry visit_months as number[] | null", () => {
    expectTypeOf<Database["public"]["Tables"]["asset_type_tasks"]["Row"]["visit_months"]>().toEqualTypeOf<number[] | null>();
  });
});
