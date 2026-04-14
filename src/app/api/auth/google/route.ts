import { NextResponse } from "next/server";
import {
  isGoogleConfigured,
  generateState,
  buildAuthorizeUrl,
} from "@/lib/google-oauth";

export async function GET(request: Request) {
  if (!isGoogleConfigured()) {
    return NextResponse.redirect(
      new URL("/login?googleError=not_configured", request.url)
    );
  }

  const url = new URL(request.url);
  const origin = url.origin;
  const state = generateState();

  const res = NextResponse.redirect(buildAuthorizeUrl(origin, state));
  res.cookies.set("oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 10 * 60,
    path: "/",
  });
  return res;
}
