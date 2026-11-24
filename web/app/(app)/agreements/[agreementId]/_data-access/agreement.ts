import { notFound, redirect } from "next/navigation";
import { canWriteRecords } from "@/components/records/state";
import { getContainer } from "@/composition";
import { skippedCodes } from "@/domain/agreement";
import { isUuid } from "@/domain/imports";
import { companyDetailsReady } from "@/domain/org-settings";
import { sharedLocation } from "@/domain/records/type-count";
import { templateChoicesOf } from "../template-choices";

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** `?version=<n>` or `?compare=<n>` as a whole number, or none: anything else shows the current version, or no comparison (AC 18, 12). */
function versionOf(value: string | undefined): number | undefined {
  return value !== undefined && /^\d+$/.test(value) ? Number(value) : undefined;
}

/**
 * What the agreement page reads: the agreement at the asked version, the org's item words, the preset codes the org lacks,
 * the company as the agreement prints it (with whether it is confirmed for sending), and for a writer on a draft the contact to
 * send to and the templates to switch between. Signed out goes to /login; a
 * malformed or foreign id is a 404.
 */
export async function loadAgreement(agreementId: string, query: Record<string, string | string[] | undefined>) {
  if (!isUuid(agreementId)) notFound();
  const { currentMember, agreementReader, getItemWords, listAssetTypes, agreementRecipient, readAgreementTemplates, getOrgSettings, siteRegister } = await getContainer();
  const member = await currentMember();
  if (member.status !== "member") redirect("/login");
  const [agreement, words, settings] = await Promise.all([
    agreementReader.get(agreementId, versionOf(first(query.version)), versionOf(first(query.compare))),
    getItemWords(member.orgId),
    // Unreadable settings read as an unconfirmed company: the page still opens, and sending is refused until they are fixed.
    Promise.resolve()
      .then(() => getOrgSettings(member.orgId))
      .catch(() => null),
  ]);
  if (!agreement) notFound();

  const canWrite = canWriteRecords(member.role);
  // Only a preset with lines can name a code the org lacks, so the types are read only then (agreement-templates AC 25).
  const skipped = agreement.template && agreement.template.preset.lines.length > 0 ? skippedCodes(agreement.template, (await listAssetTypes()).map((type) => type.code)) : [];
  const editableByWriter = canWrite && agreement.editable;
  const recipient = editableByWriter ? await agreementRecipient.get(agreementId).catch(() => null) : null;
  // A writer on a draft can switch the template: the org's own and the system one, with the pinned version kept in the list.
  const templateChoices = editableByWriter ? await templateChoicesOf(readAgreementTemplates, agreement) : undefined;
  // A draft edits its site's equipment by type: each type's active units and shared location, the org's other types to add,
  // and the site contact's name for "Goes to".
  const site = editableByWriter
    ? await Promise.resolve()
        .then(() => siteRegister(agreement.site.id))
        .catch(() => null)
    : null;
  const orgTypes = site
    ? await Promise.resolve()
        .then(() => listAssetTypes())
        .catch(() => [])
    : [];
  const siteEquipment = site
    ? orgTypes
        .map((type) => {
          const units = site.assets.filter((asset) => asset.active && asset.typeCode === type.code);
          return { assetTypeId: type.id, code: type.code, name: type.name, units: units.length, location: sharedLocation(units) };
        })
        .filter((type) => type.units > 0)
    : [];
  const addableTypes = orgTypes.filter((type) => !siteEquipment.some((onSite) => onSite.assetTypeId === type.id)).map((type) => ({ id: type.id, name: type.name }));
  const contactName = site?.contactName ?? null;
  const siteAddress = site?.address ?? null;

  // The company as the agreement prints it, and whether it may be sent with it (the send action checks the same rule).
  const company = {
    name: settings?.legalName ?? null,
    address: settings?.address ?? null,
    phone: settings?.phone ?? null,
    ready: companyDetailsReady({ legalName: settings?.legalName ?? null, address: settings?.address ?? null, phone: settings?.phone ?? null, confirmedAt: settings?.companyConfirmedAt ?? null }).ready,
  };
  return { role: member.role, canWrite, agreement, words, skippedCodes: skipped, recipient, templateChoices, company, siteEquipment, addableTypes, contactName, siteAddress };
}
