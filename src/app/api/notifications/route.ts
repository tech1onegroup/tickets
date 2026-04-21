import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest } from "@/lib/api-auth";
import { emitNotificationEvent } from "@/lib/events";

export async function GET(request: Request) {
  const auth = await authenticateRequest(request);
  if ("error" in auth) return auth.error;

  const customer = await prisma.customer.findUnique({
    where: { userId: auth.user.userId },
  });
  if (!customer) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { customerId: customer.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.notification.count({
      where: { customerId: customer.id, isRead: false },
    }),
  ]);

  return NextResponse.json({
    notifications: notifications.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      isRead: n.isRead,
      createdAt: n.createdAt.toISOString(),
    })),
    unreadCount,
  });
}

export async function PATCH(request: Request) {
  const auth = await authenticateRequest(request);
  if ("error" in auth) return auth.error;

  const customer = await prisma.customer.findUnique({
    where: { userId: auth.user.userId },
  });
  if (!customer) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  const body = await request.json();
  const { notificationId, markAllRead } = body;

  if (markAllRead) {
    await prisma.notification.updateMany({
      where: { customerId: customer.id, isRead: false },
      data: { isRead: true },
    });
    emitNotificationEvent(customer.id, { type: "unread_count", unreadCount: 0 });
    return NextResponse.json({ success: true });
  }

  if (!notificationId) {
    return NextResponse.json(
      { error: "notificationId or markAllRead required" },
      { status: 400 }
    );
  }

  // Verify notification belongs to customer
  const notification = await prisma.notification.findFirst({
    where: { id: notificationId, customerId: customer.id },
  });
  if (!notification) {
    return NextResponse.json({ error: "Notification not found" }, { status: 404 });
  }

  await prisma.notification.update({
    where: { id: notificationId },
    data: { isRead: true },
  });

  const unreadCount = await prisma.notification.count({
    where: { customerId: customer.id, isRead: false },
  });
  emitNotificationEvent(customer.id, { type: "unread_count", unreadCount });

  return NextResponse.json({ success: true });
}
