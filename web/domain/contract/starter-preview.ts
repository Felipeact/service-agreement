import type { OrgSettingsValue } from "../org-settings";
import { renderBlocks, SYSTEM_CONTRACT_BODY, templateValues, type RenderedBlock, type TemplateBody } from "./template";

/** The made-up parties a starter contract is drawn with, so the owner reads the wording as a customer would (setup-template-preview AC 7). */
export const STARTER_SAMPLE = { customer: "Sample Customer Ltd.", site: "Sample Site" } as const;

/**
 * The contract wording as it reads for this org: `SYSTEM_CONTRACT_BODY` (or a given body) with the org's saved terms and sample
 * party names filled in. A clause whose setting is not set is left out, which is `renderBlocks`' rule for a real contract too.
 */
export function buildStarterContractPreview(settings: OrgSettingsValue, body: TemplateBody = SYSTEM_CONTRACT_BODY): RenderedBlock[] {
  const values = templateValues(settings, settings.defaultTermMonths, {
    contractor: { legalName: settings.legalName, address: settings.address, phone: settings.phone },
    customer: { name: STARTER_SAMPLE.customer },
    site: { name: STARTER_SAMPLE.site, address: null },
    signer: null,
  });
  return renderBlocks(body, values);
}
