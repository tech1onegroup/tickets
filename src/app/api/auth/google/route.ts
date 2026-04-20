import { NextResponse } from "next/server";
import {
  isGoogleConfigured,
  generateState,
  buildAuthorizeUrl,
} from "@/lib/google-oauth";

function getPublicOrigin(request: Request): string {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto");
  if (forwardedHost) {
    return `${forwardedProto || "https"}://${forwardedHost}`;
  }
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }
  return new URL(request.url).origin;
}

export async function GET(request: Request) {
  if (!isGoogleConfigured()) {
    return NextResponse.redirect(
      new URL("/login?googleError=not_configured", getPublicOrigin(request))
    );
  }

  const origin = getPublicOrigin(request);
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
