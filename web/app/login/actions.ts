"use server";

import { getContainer } from "@/composition";
import type { LoginState } from "./state";

export async function requestSignInLinkAction(_previous: LoginState, formData: FormData): Promise<LoginState> {
  const value = formData.get("email");
  const email = typeof value === "string" ? value : "";
  const { requestSignInLink } = await getContainer();
  const result = await requestSignInLink(email);
  return result.ok ? { status: "sent", email: result.email } : { status: result.code, email };
}
