import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyAccessToken } from "@/lib/auth";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only protect API routes (not pages — pages use client-side auth)
  if (!pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  // Allow auth API routes without token
  if (pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  // Cron routes authenticate via CRON_SECRET (not JWT)
  if (pathname.startsWith("/api/cron/")) {
    return NextResponse.next();
  }

  // File serving: unguessable CUID+timestamp paths act as the capability,
  // similar to S3 presigned URLs. Browsers can't attach Authorization to <a> clicks.
  if (pathname.startsWith("/api/files/")) {
    return NextResponse.next();
  }

  // SSE streams: EventSource cannot set custom headers, so the route handlers
  // themselves accept ?token= as a fallback. Let them through here.
  if (
    pathname === "/api/admin/tickets/stream" ||
    /^\/api\/tickets\/[^/]+\/stream$/.test(pathname)
  ) {
    return NextResponse.next();
  }

  // Check for auth token on protected API routes
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");

  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await verifyAccessToken(token);
  if (!payload) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  // Admin API route protection
  if (
    pathname.startsWith("/api/admin") &&
    payload.role !== "ADMIN" &&
    payload.role !== "SUPER_ADMIN"
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Add user info to headers for downstream use
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-user-id", payload.userId);
  requestHeaders.set("x-user-role", payload.role);
  requestHeaders.set("x-user-phone", payload.phone);

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/api/:path*"],
};
