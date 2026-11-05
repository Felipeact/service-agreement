import Link from "next/link";

/** Links the list to itself with `?show=inactive`, and back (deactivation door 8). */
export function ShowInactiveToggle({ href, showing }: { href: string; showing: boolean }) {
  return (
    <Link
      href={showing ? href : `${href}?show=inactive`}
      className="inline-flex min-h-11 items-center text-[13px] font-medium text-action lg:min-h-0"
    >
      {showing ? "Hide inactive" : "Show inactive"}
    </Link>
  );
}
