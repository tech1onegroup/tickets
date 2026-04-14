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

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await authenticateRequest(request);
  if ("error" in auth) return auth.error;

  const customer = await prisma.customer.findUnique({
    where: { userId: auth.user.userId },
  });
  if (!customer) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  const ticket = await prisma.ticket.findFirst({
    where: { id, customerId: customer.id },
  });
  if (!ticket) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }

  if (ticket.status === "CLOSED") {
    return NextResponse.json(
      { error: "Cannot reply to a closed ticket" },
      { status: 400 }
    );
  }

  let message = "";
  let file: File | null = null;

  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    message = (form.get("message") as string) || "";
    const f = form.get("file");
    if (f && typeof f !== "string") file = f as File;
  } else {
    const body = await request.json();
    message = body.message || "";
  }

  if (!message.trim() && !file) {
    return NextResponse.json(
      { error: "Message or attachment is required" },
      { status: 400 }
    );
  }

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
    const key = `tickets/${id}/${Date.now()}-${safeName}`;
    attachmentUrl = await uploadFile(key, buffer, file.type);
    attachmentName = file.name;
    attachmentType = file.type;
    attachmentSize = file.size;
  }

  const sanitizedMessage = message.trim() ? sanitizeInput(message) : "";

  const ticketMessage = await prisma.ticketMessage.create({
    data: {
      ticketId: id,
      senderId: customer.id,
      message: sanitizedMessage,
      isInternal: false,
      attachmentUrl,
      attachmentName,
      attachmentType,
      attachmentSize,
    },
  });

  await prisma.ticket.update({
    where: { id },
    data: { updatedAt: new Date() },
  });

  return NextResponse.json(
    {
      id: ticketMessage.id,
      message: ticketMessage.message,
      attachmentUrl: ticketMessage.attachmentUrl,
      attachmentName: ticketMessage.attachmentName,
      attachmentType: ticketMessage.attachmentType,
      attachmentSize: ticketMessage.attachmentSize,
      createdAt: ticketMessage.createdAt.toISOString(),
      isCustomer: true,
    },
    { status: 201 }
  );
}
