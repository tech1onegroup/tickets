import { prisma } from "@/lib/prisma";
import { sendEmail, wrapBrandedEmail } from "@/lib/email";
import { emitNotificationEvent } from "@/lib/events";

type CreateNotificationInput = {
  customerId?: string;
  userId?: string;
  type: string;
  title: string;
  body: string;
  channels?: string;
  email?: string | null;
};

export async function createNotification(params: CreateNotificationInput) {
  if (!params.customerId && !params.userId) {
    throw new Error("createNotification requires customerId or userId");
  }

  const channels = params.channels ?? "IN_APP,SMS";

  const notification = await prisma.notification.create({
    data: {
      customerId: params.customerId ?? null,
      userId: params.userId ?? null,
      type: params.type,
      title: params.title,
      body: params.body,
      channels,
      sentAt: new Date(),
    },
  });

  if (notification.customerId) {
    const unreadCount = await prisma.notification.count({
      where: { customerId: notification.customerId, isRead: false },
    });
    emitNotificationEvent(notification.customerId, { type: "unread_count", unreadCount });
  }

  if (channels.includes("EMAIL") && params.email) {
    try {
      await sendEmail({
        to: params.email,
        subject: params.title,
        html: wrapBrandedEmail(params.title, params.body.replace(/\n/g, "<br/>")),
      });
    } catch (err) {
      console.error("[notification] email send failed", err);
    }
  }

  return notification;
}

export async function notifyAllAdmins(params: {
  type: string;
  title: string;
  body: string;
  withEmail?: boolean;
}) {
  const admins = await prisma.user.findMany({
    where: { role: { in: ["ADMIN", "SUPER_ADMIN"] }, isActive: true },
    select: { id: true, email: true },
  });

  const channels = params.withEmail ? "IN_APP,EMAIL" : "IN_APP";

  await Promise.all(
    admins.map((admin) =>
      createNotification({
        userId: admin.id,
        type: params.type,
        title: params.title,
        body: params.body,
        channels,
        email: params.withEmail ? admin.email : null,
      })
    )
  );

  return admins.length;
}
