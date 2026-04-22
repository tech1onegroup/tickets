import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest } from "@/lib/api-auth";
import { sanitizeInput } from "@/lib/sanitize";
import {
  collectAttachmentFiles,
  uploadAttachments,
} from "@/lib/ticket-attachments";
import { emitTicketEvent } from "@/lib/events";

export async function GET(request: Request) {
  const auth = await authenticateRequest(request);
  if ("error" in auth) return auth.error;

  try {
    const customer = await prisma.customer.findUnique({
      where: { userId: auth.user.userId },
    });
    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    const tickets = await prisma.ticket.findMany({
      where: { customerId: customer.id },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      tickets: tickets.map((t) => ({
        id: t.id,
        ticketRef: t.ticketRef,
        subject: t.subject,
        category: t.category,
        status: t.status,
        priority: t.priority,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("Fetch tickets error:", error);
    return NextResponse.json({ error: "Failed to fetch tickets" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await authenticateRequest(request);
  if ("error" in auth) return auth.error;

  try {
    const customer = await prisma.customer.findUnique({
      where: { userId: auth.user.userId },
    });
    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    let category = "";
    let subjectRaw = "";
    let descriptionRaw = "";
    let priority = "";
    let files: File[] = [];

    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      category = (form.get("category") as string) || "";
      subjectRaw = (form.get("subject") as string) || "";
      descriptionRaw = (form.get("description") as string) || "";
      priority = (form.get("priority") as string) || "";
      files = collectAttachmentFiles(form);
    } else {
      const body = await request.json();
      category = body.category || "";
      subjectRaw = body.subject || "";
      descriptionRaw = body.description || "";
      priority = body.priority || "";
    }

    const VALID_PRIORITIES = new Set(["LOW", "MEDIUM", "HIGH", "URGENT"]);
    const finalPriority = VALID_PRIORITIES.has(priority) ? priority : "MEDIUM";

    const subject = subjectRaw ? sanitizeInput(subjectRaw) : "";
    const description = descriptionRaw ? sanitizeInput(descriptionRaw) : "";

    const hasAttachments = files.length > 0;
    if (!category && !subject && !description && !hasAttachments) {
      return NextResponse.json(
        { error: "Add a subject, description, or attachment before submitting" },
        { status: 400 }
      );
    }

    const finalCategory = category || "GENERAL";
    const firstFileName = hasAttachments ? files[0].name : null;
    const finalSubject = subject || firstFileName || "Untitled ticket";
    const finalDescription =
      description || (hasAttachments ? "(see attachments)" : "");

    const uploadResult = await uploadAttachments(files, "tickets/new");
    if ("error" in uploadResult) {
      return NextResponse.json({ error: uploadResult.error }, { status: 400 });
    }

    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, "");
    const countToday = await prisma.ticket.count({
      where: { ticketRef: { startsWith: `TKT-${dateStr}` } },
    });
    const ticketRef = `TKT-${dateStr}-${String(countToday + 1).padStart(3, "0")}`;

    const ticket = await prisma.ticket.create({
      data: {
        ticketRef,
        customerId: customer.id,
        category: finalCategory,
        subject: finalSubject,
        description: finalDescription,
        status: "OPEN",
        priority: finalPriority,
      },
    });

    await prisma.ticketMessage.create({
      data: {
        ticketId: ticket.id,
        senderId: customer.id,
        message: finalDescription,
        attachments: {
          create: uploadResult.map((a) => ({
            url: a.url,
            name: a.name,
            type: a.type,
            size: a.size,
          })),
        },
      },
    });

    emitTicketEvent({ type: "ticket_created", ticketId: ticket.id });

    return NextResponse.json(
      { id: ticket.id, ticketRef: ticket.ticketRef },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create ticket error:", error);
    return NextResponse.json({ error: "Failed to create ticket" }, { status: 500 });
  }
}
