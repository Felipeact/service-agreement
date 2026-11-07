import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AgreementsListView } from "@/components/agreements/agreements-list";
import { getContainer } from "@/composition";
import { parseAgreementFilter } from "@/domain/agreement";
import { canWriteRecords } from "@/components/records/state";
import { today } from "@/lib/business-day";
import { NewAgreementLauncher } from "../new-agreement-launcher";

export const metadata: Metadata = { title: "Agreements" };

type Params = Parameters<typeof parseAgreementFilter>[0];

/** `?status=`, `?site=` and `?expiring=1` narrow the list; anything not valid is ignored (agreements-page Surface). */
export async function AgreementsForRequest({ params }: { params: Params }) {
  const { currentMember, listAgreements, clock } = await getContainer();
  const member = await currentMember();
  if (member.status !== "member") redirect("/login");
  const filter = parseAgreementFilter(params);
  const rows = await listAgreements(filter, today(clock.now()));
  const newAgreement = canWriteRecords(member.role) ? <NewAgreementLauncher /> : undefined;
  return <AgreementsListView rows={rows} filter={filter} role={member.role} newAgreement={newAgreement} now={clock.now()} />;
}

export default async function AgreementsPage({ searchParams }: PageProps<"/agreements">) {
  return <AgreementsForRequest params={await searchParams} />;
}
