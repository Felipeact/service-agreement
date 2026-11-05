import Link from "next/link";
import { EmptyPanel } from "@/components/ui/empty-panel";

export default function NotFound() {
  return (
    <EmptyPanel title="Not found" text="This page does not exist, or it is not part of your workspace.">
      <Link href="/customers" className="text-[13px] font-semibold text-action">
        Back to customers
      </Link>
    </EmptyPanel>
  );
}
