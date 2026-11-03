import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AgreementsListView } from "@/components/agreements/agreements-list";
import { getContainer } from "@/composition";
import { parseAgreementFilter } from "@/domain/agreement";
import { today } from "@/lib/business-day";

export const metadata: Metadata = { title: "Agreements" };

type Params = Parameters<typeof parseAgreementFilter>[0];

/** `?status=`, `?site=` and `?expiring=1` narrow the list; anything not valid is ignored (agreements-page Surface). */
export async function AgreementsForRequest({ params }: { params: Params }) {
  const { currentMember, listAgreements, listActiveSites, clock } = await getContainer();
  const member = await currentMember();
  if (member.status !== "member") redirect("/login");
  const filter = parseAgreementFilter(params);
  const [rows, sites] = await Promise.all([listAgreements(filter, today(clock.now())), listActiveSites()]);
  return <AgreementsListView rows={rows} sites={sites} filter={filter} role={member.role} />;
}

export default async function AgreementsPage({ searchParams }: PageProps<"/agreements">) {
  return <AgreementsForRequest params={await searchParams} />;
}
