import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";
import { sanitizeInput } from "@/lib/sanitize";
import { createNotification } from "@/lib/notifications";
import { uploadFile } from "@/lib/s3";

const ALLOWED_MIME = [
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
];
const MAX_BYTES = 25 * 1024 * 1024;

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if ("error" in auth) return auth.error;

  try {
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const ticketId = url.searchParams.get("id");

    // Single ticket detail with messages
    if (ticketId) {
      const ticket = await prisma.ticket.findUnique({
        where: { id: ticketId },
        include: {
          customer: { include: { user: true } },
          messages: { orderBy: { createdAt: "asc" } },
        },
      });
      if (!ticket) {
        return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
      }
      return NextResponse.json({
        ticket: {
          id: ticket.id,
          ticketRef: ticket.ticketRef,
          subject: ticket.subject,
          description: ticket.description,
          category: ticket.category,
          status: ticket.status,
          priority: ticket.priority,
          assignedTo: ticket.assignedTo,
          customerName: ticket.customer.name,
          customerPhone: ticket.customer.phone,
          createdAt: ticket.createdAt.toISOString(),
          messages: ticket.messages.map((m) => ({
            id: m.id,
            senderId: m.senderId,
            message: m.message,
            isInternal: m.isInternal,
            isAdmin: m.senderId !== ticket.customerId,
            attachmentUrl: m.attachmentUrl,
            attachmentName: m.attachmentName,
            attachmentType: m.attachmentType,
            attachmentSize: m.attachmentSize,
            createdAt: m.createdAt.toISOString(),
          })),
        },
      });
    }

    // List all tickets
    const where = status && status !== "ALL" ? { status } : {};
    const tickets = await prisma.ticket.findMany({
      where,
      include: { customer: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    const counts = await Promise.all([
      prisma.ticket.count({ where: { status: "OPEN" } }),
      prisma.ticket.count({ where: { status: "IN_PROGRESS" } }),
      prisma.ticket.count({ where: { status: "RESOLVED" } }),
      prisma.ticket.count({ where: { status: "CLOSED" } }),
    ]);

    return NextResponse.json({
      tickets: tickets.map((t) => ({
        id: t.id,
        ticketRef: t.ticketRef,
        subject: t.subject,
        category: t.category,
        status: t.status,
        priority: t.priority,
        customerName: t.customer.name,
        customerPhone: t.customer.phone,
        assignedTo: t.assignedTo,
        createdAt: t.createdAt.toISOString(),
      })),
      counts: {
        open: counts[0],
        inProgress: counts[1],
        resolved: counts[2],
        closed: counts[3],
        total: counts[0] + counts[1] + counts[2] + counts[3],
      },
    });
  } catch (error) {
    console.error("Fetch tickets error:", error);
    return NextResponse.json({ error: "Failed to fetch tickets" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin(request);
  if ("error" in auth) return auth.error;

  try {
    let ticketId = "";
    let status = "";
    let reply = "";
    let priority = "";
    let file: File | null = null;

    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      ticketId = (form.get("ticketId") as string) || "";
      status = (form.get("status") as string) || "";
      reply = (form.get("reply") as string) || "";
      priority = (form.get("priority") as string) || "";
      const f = form.get("file");
      if (f && typeof f !== "string") file = f as File;
    } else {
      const body = await request.json();
      ticketId = body.ticketId || "";
      status = body.status || "";
      reply = body.reply || "";
      priority = body.priority || "";
    }

    const VALID_PRIORITIES = new Set(["LOW", "MEDIUM", "HIGH", "URGENT"]);

    if (!ticketId) {
      return NextResponse.json({ error: "ticketId required" }, { status: 400 });
    }

    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    if (status) {
      await prisma.ticket.update({
        where: { id: ticketId },
        data: {
          status,
          assignedTo: auth.user.userId,
          resolvedAt: status === "RESOLVED" || status === "CLOSED" ? new Date() : undefined,
        },
      });
    }

    if (priority && VALID_PRIORITIES.has(priority)) {
      await prisma.ticket.update({
        where: { id: ticketId },
        data: { priority },
      });
    }

    if (reply || file) {
      let attachmentUrl: string | null = null;
      let attachmentName: string | null = null;
      let attachmentType: string | null = null;
      let attachmentSize: number | null = null;

      if (file) {
        if (!ALLOWED_MIME.includes(file.type)) {
          return NextResponse.json(
            { error: "Only PDF and image files (jpg, png, webp) are allowed" },
            { status: 400 }
          );
        }
        if (file.size > MAX_BYTES) {
          return NextResponse.json(
            { error: "File too large (max 25MB)" },
            { status: 400 }
          );
        }
        const buffer = Buffer.from(await file.arrayBuffer());
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const key = `tickets/${ticketId}/${Date.now()}-${safeName}`;
        attachmentUrl = await uploadFile(key, buffer, file.type);
        attachmentName = file.name;
        attachmentType = file.type;
        attachmentSize = file.size;
      }

      const sanitizedReply = reply ? sanitizeInput(reply) : "";

      await prisma.ticketMessage.create({
        data: {
          ticketId,
          senderId: auth.user.userId,
          message: sanitizedReply,
          attachmentUrl,
          attachmentName,
          attachmentType,
          attachmentSize,
        },
      });

      if (ticket.status === "OPEN") {
        await prisma.ticket.update({
          where: { id: ticketId },
          data: { status: "IN_PROGRESS", assignedTo: auth.user.userId },
        });
      }
    }

    const notifyBody =
      reply || file
        ? `Your ticket #${ticket.ticketRef} has a new reply from support.`
        : status
        ? `Your ticket #${ticket.ticketRef} status changed to ${status}.`
        : priority
        ? `Your ticket #${ticket.ticketRef} priority changed to ${priority}.`
        : null;

    if (notifyBody) {
      await createNotification({
        customerId: ticket.customerId,
        type: "TICKET_UPDATE",
        title: "Ticket Updated",
        body: notifyBody,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Update ticket error:", error);
    return NextResponse.json({ error: "Failed to update ticket" }, { status: 500 });
  }
}
