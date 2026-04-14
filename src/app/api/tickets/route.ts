import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest } from "@/lib/api-auth";
import { sanitizeInput } from "@/lib/sanitize";
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
      take: 50,
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
    let file: File | null = null;

    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      category = (form.get("category") as string) || "";
      subjectRaw = (form.get("subject") as string) || "";
      descriptionRaw = (form.get("description") as string) || "";
      priority = (form.get("priority") as string) || "";
      const f = form.get("file");
      if (f && typeof f !== "string") file = f as File;
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

    if (!category && !subject && !description && !file) {
      return NextResponse.json(
        { error: "Add a subject, description, or attachment before submitting" },
        { status: 400 }
      );
    }

    const finalCategory = category || "GENERAL";
    const finalSubject = subject || (file ? file.name : "Untitled ticket");
    const finalDescription = description || (file ? "(see attachment)" : "");

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
      const key = `tickets/new/${Date.now()}-${safeName}`;
      attachmentUrl = await uploadFile(key, buffer, file.type);
      attachmentName = file.name;
      attachmentType = file.type;
      attachmentSize = file.size;
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
        attachmentUrl,
        attachmentName,
        attachmentType,
        attachmentSize,
      },
    });

    return NextResponse.json(
      { id: ticket.id, ticketRef: ticket.ticketRef },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create ticket error:", error);
    return NextResponse.json({ error: "Failed to create ticket" }, { status: 500 });
  }
}
