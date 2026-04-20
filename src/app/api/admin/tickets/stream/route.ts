import { NextResponse } from "next/server";
import { verifyAccessToken } from "@/lib/auth";
import { onAdminEvent, TicketEvent } from "@/lib/events";
import { sseResponse } from "@/lib/sse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  let token = authHeader?.replace("Bearer ", "") || "";
  if (!token) {
    token = new URL(request.url).searchParams.get("token") || "";
  }
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await verifyAccessToken(token);
  if (!payload) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }
  if (payload.role !== "ADMIN" && payload.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return sseResponse((send) => {
    const handler = (event: TicketEvent) => send(event);
    return onAdminEvent(handler);
  });
}
