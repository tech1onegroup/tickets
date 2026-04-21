import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequestOrQuery } from "@/lib/api-auth";
import { onNotificationEvent, NotificationEvent } from "@/lib/events";
import { sseResponse } from "@/lib/sse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await authenticateRequestOrQuery(request);
  if ("error" in auth) return auth.error;

  const customer = await prisma.customer.findUnique({
    where: { userId: auth.user.userId },
  });
  if (!customer) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  const customerId = customer.id;
  const unreadCount = await prisma.notification.count({
    where: { customerId, isRead: false },
  });

  return sseResponse((send) => {
    send({ type: "unread_count", unreadCount });
    return onNotificationEvent(customerId, (event: NotificationEvent) => {
      send(event);
    });
  });
}
