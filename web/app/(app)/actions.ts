"use server";

import { redirect } from "next/navigation";
import { getContainer } from "@/composition";

export async function signOutAction() {
  const { signOut } = await getContainer();
  await signOut();
  redirect("/login");
}
