import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequestOrQuery } from "@/lib/api-auth";
import { onTicketEvent, TicketEvent } from "@/lib/events";
import { sseResponse } from "@/lib/sse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const auth = await authenticateRequestOrQuery(request);
  if ("error" in auth) return auth.error;

  // Authorize: the caller must own this ticket (customer) OR be an admin.
  const isAdmin =
    auth.user.role === "ADMIN" || auth.user.role === "SUPER_ADMIN";

  if (!isAdmin) {
    const customer = await prisma.customer.findUnique({
      where: { userId: auth.user.userId },
    });
    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }
    const ticket = await prisma.ticket.findFirst({
      where: { id, customerId: customer.id },
      select: { id: true },
    });
    if (!ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }
  }

  return sseResponse((send) => {
    const handler = (event: TicketEvent) => {
      // Customers should not see internal admin notes — filter here.
      if (!isAdmin && event.type === "message") {
        const msg = event.message as { isInternal?: boolean } | undefined;
        if (msg?.isInternal) return;
      }
      send(event);
    };
    return onTicketEvent(id, handler);
  });
}
