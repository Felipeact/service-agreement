import { isUuid } from "../imports";
import type { ContractStatus } from "../contract";
import { PIPELINE_STAGES, pipelineStage } from "../pipeline";
import type { AgreementStatus } from "./index";

/** The seven values of the Agreements page `status` filter: the pipeline stages, plus the two endings a stage hides (agreements-page door 1). */
export const STATUS_FILTER_VALUES = [...PIPELINE_STAGES, "expired", "withdrawn"] as const;
export type StatusFilterValue = (typeof STATUS_FILTER_VALUES)[number];

export type AgreementFilter = { status?: StatusFilterValue; siteId?: string; expiring?: boolean };

type Params = Record<string, string | string[] | undefined>;

function single(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

/** The filter a URL asks for; a value that is not valid is dropped, never an error (agreements-page AC 6). */
export function parseAgreementFilter(params: Params): AgreementFilter {
  const status = single(params.status);
  const site = single(params.site);
  return {
    ...(status && (STATUS_FILTER_VALUES as readonly string[]).includes(status) && { status: status as StatusFilterValue }),
    ...(site && isUuid(site) && { siteId: site }),
    ...(single(params.expiring) === "1" && { expiring: true }),
  };
}

/** Whether an agreement stays under `value`: a stage key by `pipelineStage`, `expired` and `withdrawn` by status alone. */
export function matchesStatusFilter(value: StatusFilterValue, status: AgreementStatus, contract?: ContractStatus | null): boolean {
  if (value === "expired" || value === "withdrawn") return status === value;
  return pipelineStage(status, contract) === value;
}
