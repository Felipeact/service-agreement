import type { Metadata } from "next";
import { canWriteRecords } from "@/components/records/state";
import { parseAgreementFilter } from "@/domain/agreement";
import { NewAgreementLauncher } from "../new-agreement-launcher";
import { AgreementsListView } from "./_components/content";
import { loadAgreements } from "./_data-access/agreements";

export const metadata: Metadata = { title: "Agreements" };

type Params = Parameters<typeof parseAgreementFilter>[0];

/** `?status=`, `?site=` and `?expiring=1` narrow the list; anything not valid is ignored (agreements-page Surface). */
export async function AgreementsForRequest({ params }: { params: Params }) {
  const filter = parseAgreementFilter(params);
  const { role, rows, counts, now } = await loadAgreements(filter);
  const newAgreement = canWriteRecords(role) ? <NewAgreementLauncher /> : undefined;
  return <AgreementsListView rows={rows} filter={filter} role={role} newAgreement={newAgreement} now={now} counts={counts} />;
}

export default async function AgreementsPage({ searchParams }: PageProps<"/agreements">) {
  return <AgreementsForRequest params={await searchParams} />;
}
