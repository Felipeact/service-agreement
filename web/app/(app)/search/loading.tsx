import { PageLoading } from "@/components/shell/page-loading";

export default function Loading() {
  return (
    <div aria-busy="true">
      <PageLoading title="Search" />
    </div>
  );
}
