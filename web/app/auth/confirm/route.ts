import { NextResponse, type NextRequest } from "next/server";
import { getContainer } from "@/composition";

/** The sign-in email links here with `token_hash` and `type=email` (door 3). */
export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");

  // Never echo the token into the next URL.
  const target = request.nextUrl.clone();
  target.search = "";

  if (tokenHash && type === "email") {
    const { verifyEmailLink } = await getContainer();
    const result = await verifyEmailLink(tokenHash);
    if (result.ok) {
      target.pathname = "/pipeline";
      return NextResponse.redirect(target);
    }
  }

  target.pathname = "/login";
  target.searchParams.set("error", "link_invalid");
  return NextResponse.redirect(target);
}
