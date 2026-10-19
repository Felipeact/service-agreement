import type { PipelineStage } from "./pipeline-stage";

export type PipelineCard = {
  id: string;
  stage: PipelineStage;
  customer: string;
  /** Agreement number and version, or a status note. */
  meta: string;
  /** Label for an attention pill, when the deal needs the estimator. */
  attention?: string;
  visitsPerYear?: number;
  annualCents?: number;
};

/** Fictitious sample deals shown until Phase 1 brings real data. */
export const SAMPLE_PIPELINE: PipelineCard[] = [
  { id: "ag-1048", stage: "in_progress", customer: "Harbourview Towers Strata", meta: "AG-1048 · v3", attention: "Changes requested", visitsPerYear: 4, annualCents: 1428000 },
  { id: "ag-1046", stage: "in_progress", customer: "Pinecrest Office Park", meta: "AG-1046 · v1", visitsPerYear: 4, annualCents: 2160000 },
  { id: "ag-1051", stage: "in_progress", customer: "Lakeshore Brewing Co.", meta: "AG-1051 · import pending" },
  { id: "ag-1039", stage: "sent", customer: "Northgate Self Storage", meta: "Sent 9 days ago", attention: "Not viewed", visitsPerYear: 2, annualCents: 412000 },
  { id: "ag-1042", stage: "sent", customer: "Juniper Medical Clinic", meta: "Viewed Oct 9", visitsPerYear: 4, annualCents: 988000 },
  { id: "ag-1044", stage: "sent", customer: "Copperleaf Seniors Residence", meta: "Viewed today", visitsPerYear: 6, annualCents: 1945050 },
  { id: "ag-1031", stage: "accepted", customer: "Tidewater Hotel", meta: "Client signed", attention: "Awaiting countersignature", visitsPerYear: 4, annualCents: 1890000 },
  { id: "ag-1035", stage: "accepted", customer: "Glacier Valley Cold Storage", meta: "Sent for signature", visitsPerYear: 12, annualCents: 880000 },
  { id: "ag-1022", stage: "completed", customer: "Brookhaven Community Centre", meta: "Signed Oct 3", visitsPerYear: 4, annualCents: 1120000 },
  { id: "ag-1019", stage: "completed", customer: "Ridgeline Retail Plaza", meta: "Signed Sep 28", visitsPerYear: 2, annualCents: 760000 },
  { id: "ag-1027", stage: "refused", customer: "Saltmarsh Bakery", meta: "In-house maintenance" },
  { id: "ag-1029", stage: "refused", customer: "Fernwood Dental", meta: "Over budget" },
];
