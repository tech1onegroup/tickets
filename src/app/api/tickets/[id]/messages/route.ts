import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest } from "@/lib/api-auth";
import { sanitizeInput } from "@/lib/sanitize";
import {
  collectAttachmentFiles,
  uploadAttachments,
} from "@/lib/ticket-attachments";
import { emitTicketEvent } from "@/lib/events";

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
  let files: File[] = [];

  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    message = (form.get("message") as string) || "";
    files = collectAttachmentFiles(form);
  } else {
    const body = await request.json();
    message = body.message || "";
  }

  if (!message.trim() && files.length === 0) {
    return NextResponse.json(
      { error: "Message or attachment is required" },
      { status: 400 }
    );
  }

  const uploadResult = await uploadAttachments(files, `tickets/${id}`);
  if ("error" in uploadResult) {
    return NextResponse.json({ error: uploadResult.error }, { status: 400 });
  }

  const sanitizedMessage = message.trim() ? sanitizeInput(message) : "";

  const ticketMessage = await prisma.ticketMessage.create({
    data: {
      ticketId: id,
      senderId: customer.id,
      message: sanitizedMessage,
      isInternal: false,
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

  await prisma.ticket.update({
    where: { id },
    data: { updatedAt: new Date() },
  });

  const customerMessage = {
    id: ticketMessage.id,
    senderId: ticketMessage.senderId,
    message: ticketMessage.message,
    attachments: ticketMessage.attachments.map((a) => ({
      id: a.id,
      url: a.url,
      name: a.name,
      type: a.type,
      size: a.size,
    })),
    createdAt: ticketMessage.createdAt.toISOString(),
    isCustomer: true,
    isAdmin: false,
    isInternal: false,
  };

  emitTicketEvent({
    type: "message",
    ticketId: id,
    message: customerMessage,
    isCustomer: true,
  });

  return NextResponse.json(customerMessage, { status: 201 });
}
