import { LINK_NOT_WORKING } from "@/domain/portal";

/** What a malformed or unknown address says; it names no tenant and no agreement (customer-portal AC 9). */
export function LinkNotWorking() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col justify-center gap-2 px-4 py-10">
      <h1 className="text-[18px] font-bold">{LINK_NOT_WORKING}</h1>
    </main>
  );
}
