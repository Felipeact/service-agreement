import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Sign in",
};

const PRODUCT_NAME = "Service Agreement";

/** Reads `?error=` at request time; the plain form is the prerendered fallback (door 6). */
export async function LoginFormForRequest({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const { error } = await searchParams;
  return <LoginForm linkInvalid={error === "link_invalid"} />;
}

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main className="flex min-h-dvh flex-col items-center px-4 pt-[12vh] pb-10">
      <div className="w-full max-w-[400px]">
        <p className="pb-4 text-[15px] font-bold">{PRODUCT_NAME}</p>
        <div className="rounded-panel border border-hairline bg-surface px-6 py-7 sm:px-8">
          <Suspense fallback={<LoginForm linkInvalid={false} />}>
            <LoginFormForRequest searchParams={searchParams} />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
