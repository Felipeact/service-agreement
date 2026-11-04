import { NextResponse, type NextRequest } from "next/server";
import { getContainer } from "@/composition";
import { publicOrigin } from "@/lib/public-origin";

/** The sign-in email links here with `token_hash` and `type=email` (door 3). */
export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");

  // Never echo the token into the next URL, and never redirect to the container's own address behind a proxy.
  const target = new URL(publicOrigin(request.nextUrl, request.headers, process.env.APP_BASE_URL));

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
