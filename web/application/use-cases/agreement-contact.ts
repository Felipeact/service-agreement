import type { ContactStore, CustomerDirectory, SiteRegister } from "@/application/ports";

/** The site contact's email, which a send writes to (`agreement_recipient` / `set_agreement_recipient`). */
export type AgreementRecipientStore = {
  get(agreementId: string): Promise<string | null>;
  set(agreementId: string, email: string): Promise<boolean>;
};

export type AgreementContactResult = { ok: true } | { ok: false; code: "not_found" | "invalid" | "forbidden" | "unavailable" };

/**
 * Changes who an agreement goes to: the site contact's name and email. A site with a contact has it updated (its phone kept); a
 * site without one gets a contact made from the email first (`set_agreement_recipient`), then named.
 */
export function makeSetAgreementContact(register: Pick<SiteRegister, "get">, contacts: Pick<CustomerDirectory, "contact">, store: Pick<ContactStore, "update">, recipient: AgreementRecipientStore) {
  return async function setAgreementContact(agreementId: string, siteId: string, name: string, email: string): Promise<AgreementContactResult> {
    try {
      let site = await register.get(siteId);
      if (!site) return { ok: false, code: "not_found" };
      if (!site.siteContactId) {
        if (!(await recipient.set(agreementId, email))) return { ok: false, code: "invalid" };
        site = await register.get(siteId);
        if (!site?.siteContactId) return { ok: false, code: "unavailable" };
      }
      const contact = await contacts.contact(site.siteContactId);
      if (!contact) return { ok: false, code: "not_found" };
      const saved = await store.update(contact.id, { name, email, phone: contact.phone });
      return saved.ok ? { ok: true } : { ok: false, code: saved.code };
    } catch {
      return { ok: false, code: "unavailable" };
    }
  };
}
