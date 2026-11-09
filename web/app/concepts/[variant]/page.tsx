import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HomeA, HomeB, HomeC } from "@/components/site/home-concepts";

const CONCEPTS = { a: HomeA, b: HomeB, c: HomeC } as const;

export const metadata: Metadata = { title: "Home concept", robots: { index: false } };

export function generateStaticParams() {
  return Object.keys(CONCEPTS).map((variant) => ({ variant }));
}

/** Preview of the three home-page concepts: /concepts/a, /concepts/b, /concepts/c. Removed once one is chosen. */
export default async function ConceptPage({ params }: PageProps<"/concepts/[variant]">) {
  const { variant } = await params;
  const Concept = CONCEPTS[variant as keyof typeof CONCEPTS];
  if (!Concept) notFound();
  return <Concept />;
}
