import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SearchView } from "@/components/search/search-view";
import { getContainer } from "@/composition";
import { parseSearchQuery } from "@/domain/records";

export const metadata: Metadata = { title: "Search" };

type Params = Parameters<typeof parseSearchQuery>[0];

/** `?q=` is the whole input; a blank one reads nothing (global-search Surface, AC 15). */
export async function SearchForRequest({ params }: { params: Params }) {
  const { currentMember, searchRecords } = await getContainer();
  const member = await currentMember();
  if (member.status !== "member") redirect("/login");
  const query = parseSearchQuery(params);
  const results = query ? await searchRecords(query) : null;
  return <SearchView query={query} results={results} />;
}

export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  return <SearchForRequest params={await searchParams} />;
}
