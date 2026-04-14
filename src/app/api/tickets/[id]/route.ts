import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest } from "@/lib/api-auth";

export async function GET(
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
    include: {
      messages: {
        where: { isInternal: false },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!ticket) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: ticket.id,
    ticketRef: ticket.ticketRef,
    subject: ticket.subject,
    description: ticket.description,
    category: ticket.category,
    status: ticket.status,
    priority: ticket.priority,
    createdAt: ticket.createdAt.toISOString(),
    updatedAt: ticket.updatedAt.toISOString(),
    resolvedAt: ticket.resolvedAt?.toISOString() || null,
    messages: ticket.messages.map((m) => ({
      id: m.id,
      senderId: m.senderId,
      message: m.message,
      attachmentUrl: m.attachmentUrl,
      attachmentName: m.attachmentName,
      attachmentType: m.attachmentType,
      attachmentSize: m.attachmentSize,
      createdAt: m.createdAt.toISOString(),
      isCustomer: m.senderId === customer.id,
    })),
  });
}
