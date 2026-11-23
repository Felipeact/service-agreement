import type { Metadata } from "next";
import { Suspense } from "react";
import { Content } from "./_components/content";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Sign in",
};

/** Reads `?error=` at request time; the plain form is the prerendered fallback (door 6). */
export async function LoginFormForRequest({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const { error } = await searchParams;
  return <LoginForm linkInvalid={error === "link_invalid"} />;
}

/** The sign-in page from the owner's mockup (docs/service_pacts_sign_in_animated_split_1); the form is the live one. */
export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <Content
      form={
        <Suspense fallback={<LoginForm linkInvalid={false} />}>
          <LoginFormForRequest searchParams={searchParams} />
        </Suspense>
      }
    />
  );
}
