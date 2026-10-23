import { expect, test } from "vitest";
import { PIPELINE_STAGES as domainStages } from "@/domain/pipeline";
import { PIPELINE_STAGES } from "./pipeline-stage";

test("C19: lib re-exports the domain's PIPELINE_STAGES object", () => {
  expect(PIPELINE_STAGES).toBe(domainStages);
});
