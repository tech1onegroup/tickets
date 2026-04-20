import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";
import { sanitizeInput } from "@/lib/sanitize";
import { createNotification } from "@/lib/notifications";
import {
  collectAttachmentFiles,
  uploadAttachments,
} from "@/lib/ticket-attachments";
import { emitTicketEvent } from "@/lib/events";

const VALID_PRIORITIES = new Set(["LOW", "MEDIUM", "HIGH", "URGENT"]);
const STALE_MS = 48 * 60 * 60 * 1000;

type MsgWithAttachments = {
  attachmentUrl: string | null;
  attachmentName: string | null;
  attachmentType: string | null;
  attachmentSize: number | null;
  attachments: Array<{
    id: string;
    url: string;
    name: string;
    type: string;
    size: number;
  }>;
};

function buildAttachmentList(m: MsgWithAttachments) {
  const list = m.attachments.map((a) => ({
    id: a.id,
    url: a.url,
    name: a.name,
    type: a.type,
    size: a.size,
  }));
  if (list.length === 0 && m.attachmentUrl) {
    list.push({
      id: "legacy",
      url: m.attachmentUrl,
      name: m.attachmentName || "attachment",
      type: m.attachmentType || "application/octet-stream",
      size: m.attachmentSize || 0,
    });
  }
  return list;
}

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if ("error" in auth) return auth.error;

  try {
    const url = new URL(request.url);
    const ticketId = url.searchParams.get("id");

    if (ticketId) {
      const ticket = await prisma.ticket.findUnique({
        where: { id: ticketId },
        include: {
          customer: { include: { user: true } },
          messages: {
            orderBy: { createdAt: "asc" },
            include: { attachments: true },
          },
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
            attachments: buildAttachmentList(m),
            createdAt: m.createdAt.toISOString(),
          })),
        },
      });
    }

    const status = url.searchParams.get("status");
    const category = url.searchParams.get("category");
    const priority = url.searchParams.get("priority");
    const assignedParam = url.searchParams.get("assignedTo");
    const unassigned = url.searchParams.get("unassigned") === "true";
    const q = url.searchParams.get("q")?.trim();

    const assignedToFilter =
      assignedParam === "me" ? auth.user.userId : assignedParam || "";

    const where: Record<string, unknown> = {};
    if (status && status !== "ALL") where.status = status;
    if (category && category !== "ALL") where.category = category;
    if (priority && priority !== "ALL") where.priority = priority;
    if (unassigned) where.assignedTo = null;
    else if (assignedToFilter) where.assignedTo = assignedToFilter;

    if (q) {
      where.OR = [
        { ticketRef: { contains: q } },
        { subject: { contains: q } },
        { customer: { is: { name: { contains: q } } } },
        { customer: { is: { phone: { contains: q } } } },
      ];
    }

    const tickets = await prisma.ticket.findMany({
      where,
      include: {
        customer: true,
        messages: {
          where: { isInternal: false },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    const adminIds = Array.from(
      new Set(
        tickets
          .map((t) => t.assignedTo)
          .filter((x): x is string => typeof x === "string")
      )
    );
    const admins = adminIds.length
      ? await prisma.user.findMany({
          where: { id: { in: adminIds } },
          select: { id: true, phone: true, email: true },
        })
      : [];
    const adminLabel = new Map(
      admins.map((a) => [a.id, a.email || `+91 ${a.phone}`])
    );

    const now = Date.now();
    const enriched = tickets.map((t) => {
      const last = t.messages[0];
      const lastMessageAt = last
        ? last.createdAt.toISOString()
        : t.createdAt.toISOString();
      const lastMessageFromCustomer = last ? last.senderId === t.customerId : true;
      const lastTs = last ? last.createdAt.getTime() : t.createdAt.getTime();
      const isStale = now - lastTs > STALE_MS;
      return {
        id: t.id,
        ticketRef: t.ticketRef,
        subject: t.subject,
        category: t.category,
        status: t.status,
        priority: t.priority,
        customerName: t.customer.name,
        customerPhone: t.customer.phone,
        assignedTo: t.assignedTo,
        assignedToLabel: t.assignedTo ? adminLabel.get(t.assignedTo) || null : null,
        createdAt: t.createdAt.toISOString(),
        lastMessageAt,
        lastMessageFromCustomer,
        isStale,
      };
    });

    const [open, inProgress, resolved, closed, myOpen, unassignedCount] =
      await Promise.all([
        prisma.ticket.count({ where: { status: "OPEN" } }),
        prisma.ticket.count({ where: { status: "IN_PROGRESS" } }),
        prisma.ticket.count({ where: { status: "RESOLVED" } }),
        prisma.ticket.count({ where: { status: "CLOSED" } }),
        prisma.ticket.count({
          where: {
            assignedTo: auth.user.userId,
            status: { in: ["OPEN", "IN_PROGRESS"] },
          },
        }),
        prisma.ticket.count({
          where: { assignedTo: null, status: { in: ["OPEN", "IN_PROGRESS"] } },
        }),
      ]);

    return NextResponse.json({
      tickets: enriched,
      counts: {
        open,
        inProgress,
        resolved,
        closed,
        total: open + inProgress + resolved + closed,
        myOpen,
        unassigned: unassignedCount,
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
    let assignedTo: string | null | undefined = undefined;
    let isInternal = false;
    let files: File[] = [];

    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      ticketId = (form.get("ticketId") as string) || "";
      status = (form.get("status") as string) || "";
      reply = (form.get("reply") as string) || "";
      priority = (form.get("priority") as string) || "";
      if (form.has("assignedTo")) {
        const v = form.get("assignedTo");
        assignedTo = typeof v === "string" && v ? v : null;
      }
      isInternal = (form.get("isInternal") as string) === "true";
      files = collectAttachmentFiles(form);
    } else {
      const body = await request.json();
      ticketId = body.ticketId || "";
      status = body.status || "";
      reply = body.reply || "";
      priority = body.priority || "";
      if ("assignedTo" in body) assignedTo = body.assignedTo || null;
      isInternal = Boolean(body.isInternal);
    }

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
          assignedTo: ticket.assignedTo || auth.user.userId,
          resolvedAt:
            status === "RESOLVED" || status === "CLOSED" ? new Date() : undefined,
        },
      });
    }

    if (priority && VALID_PRIORITIES.has(priority)) {
      await prisma.ticket.update({
        where: { id: ticketId },
        data: { priority },
      });
    }

    if (assignedTo !== undefined) {
      if (assignedTo) {
        const admin = await prisma.user.findFirst({
          where: {
            id: assignedTo,
            role: { in: ["ADMIN", "SUPER_ADMIN"] },
            isActive: true,
          },
        });
        if (!admin) {
          return NextResponse.json(
            { error: "Invalid assignee" },
            { status: 400 }
          );
        }
      }
      await prisma.ticket.update({
        where: { id: ticketId },
        data: { assignedTo: assignedTo },
      });
    }

    const hasAttachments = files.length > 0;

    if (reply || hasAttachments) {
      const uploadResult = await uploadAttachments(
        files,
        `tickets/${ticketId}`
      );
      if ("error" in uploadResult) {
        return NextResponse.json(
          { error: uploadResult.error },
          { status: 400 }
        );
      }

      const sanitizedReply = reply ? sanitizeInput(reply) : "";

      const created = await prisma.ticketMessage.create({
        data: {
          ticketId,
          senderId: auth.user.userId,
          message: sanitizedReply,
          isInternal,
          attachments: {
            create: uploadResult.map((a) => ({
              url: a.url,
              name: a.name,
              type: a.type,
              size: a.size,
            })),
          },
        },
        include: { attachments: true },
      });

      if (!isInternal && ticket.status === "OPEN") {
        await prisma.ticket.update({
          where: { id: ticketId },
          data: { status: "IN_PROGRESS", assignedTo: auth.user.userId },
        });
      }

      emitTicketEvent({
        type: "message",
        ticketId,
        isCustomer: false,
        message: {
          id: created.id,
          senderId: created.senderId,
          message: created.message,
          isAdmin: true,
          isCustomer: false,
          isInternal: created.isInternal,
          attachments: created.attachments.map((a) => ({
            id: a.id,
            url: a.url,
            name: a.name,
            type: a.type,
            size: a.size,
          })),
          createdAt: created.createdAt.toISOString(),
        },
      });
    }

    if (status || priority || assignedTo !== undefined) {
      emitTicketEvent({ type: "ticket_changed", ticketId });
    }

    const notifyBody = isInternal
      ? null
      : reply || hasAttachments
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
