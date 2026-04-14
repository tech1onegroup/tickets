import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { signAccessToken, generateRefreshToken } from "@/lib/auth";
import {
  isGoogleConfigured,
  exchangeCodeForUserInfo,
} from "@/lib/google-oauth";

function errorRedirect(request: Request, code: string) {
  return NextResponse.redirect(
    new URL(`/login?googleError=${code}`, request.url)
  );
}

export async function GET(request: Request) {
  if (!isGoogleConfigured()) {
    return errorRedirect(request, "not_configured");
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const googleErr = url.searchParams.get("error");

  if (googleErr) {
    return errorRedirect(request, googleErr);
  }
  if (!code || !state) {
    return errorRedirect(request, "missing_code");
  }

  const cookieHeader = request.headers.get("cookie") || "";
  const stateMatch = cookieHeader
    .split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith("oauth_state="));
  const expectedState = stateMatch ? stateMatch.split("=")[1] : null;
  if (!expectedState || expectedState !== state) {
    return errorRedirect(request, "state_mismatch");
  }

  let info;
  try {
    info = await exchangeCodeForUserInfo(code, url.origin);
  } catch (e) {
    console.error("Google OAuth exchange failed:", e);
    return errorRedirect(request, "exchange_failed");
  }

  const email = (info.email || "").toLowerCase().trim();
  if (!email) {
    return errorRedirect(request, "no_email");
  }
  if (info.email_verified === false) {
    return errorRedirect(request, "email_not_verified");
  }

  // Look up by User.email first, then by Customer.email -> User
  let user = await prisma.user.findFirst({ where: { email } });
  if (!user) {
    const customer = await prisma.customer.findFirst({
      where: { email },
      include: { user: true },
    });
    if (customer) user = customer.user;
  }

  if (!user || !user.isActive) {
    return errorRedirect(request, "no_account");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  const accessToken = await signAccessToken({
    userId: user.id,
    phone: user.phone,
    role: user.role,
  });

  const refreshToken = generateRefreshToken();
  const refreshExpiryDays = parseInt(
    process.env.REFRESH_TOKEN_EXPIRY_DAYS || "30"
  );
  await prisma.session.create({
    data: {
      userId: user.id,
      token: refreshToken,
      expiresAt: new Date(
        Date.now() + refreshExpiryDays * 24 * 60 * 60 * 1000
      ),
    },
  });

  // Hand off access token via URL fragment (never hits server logs)
  const redirect = NextResponse.redirect(
    new URL(`/auth/google-complete#token=${accessToken}`, request.url)
  );
  redirect.cookies.set("refresh_token", refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: refreshExpiryDays * 24 * 60 * 60,
    path: "/",
  });
  redirect.cookies.delete("oauth_state");
  return redirect;
}
