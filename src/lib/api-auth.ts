import { verifyAccessToken, JWTPayload } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function authenticateRequest(
  request: Request
): Promise<{ user: JWTPayload } | { error: NextResponse }> {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");

  if (!token) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const payload = await verifyAccessToken(token);
  if (!payload) {
    return { error: NextResponse.json({ error: "Invalid token" }, { status: 401 }) };
  }

  return { user: payload };
}

export async function requireAdmin(
  request: Request
): Promise<{ user: JWTPayload } | { error: NextResponse }> {
  const result = await authenticateRequest(request);
  if ("error" in result) return result;

  if (result.user.role !== "ADMIN" && result.user.role !== "SUPER_ADMIN") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return result;
}

/**
 * Authenticate via `Authorization` header OR `?token=...` query param.
 * Needed for EventSource connections, which cannot set custom headers.
 */
export async function authenticateRequestOrQuery(
  request: Request
): Promise<{ user: JWTPayload } | { error: NextResponse }> {
  const authHeader = request.headers.get("authorization");
  let token = authHeader?.replace("Bearer ", "") || "";
  if (!token) {
    token = new URL(request.url).searchParams.get("token") || "";
  }

  if (!token) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const payload = await verifyAccessToken(token);
  if (!payload) {
    return { error: NextResponse.json({ error: "Invalid token" }, { status: 401 }) };
  }

  return { user: payload };
}
