import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";
import { z } from "zod";

const updateSchema = z.object({
  title: z.string().max(10).optional().or(z.literal("")),
  name: z.string().min(1, "Name is required").max(100),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  altPhone: z
    .string()
    .regex(/^[6-9]\d{9}$/, "Invalid phone")
    .optional()
    .or(z.literal("")),
  address: z.string().max(500).optional().or(z.literal("")),
  city: z.string().max(100).optional().or(z.literal("")),
  state: z.string().max(100).optional().or(z.literal("")),
  pincode: z
    .string()
    .regex(/^\d{6}$/, "Pincode must be 6 digits")
    .optional()
    .or(z.literal("")),
  panNumber: z
    .string()
    .regex(/^[A-Z]{5}\d{4}[A-Z]$/, "Invalid PAN format")
    .optional()
    .or(z.literal("")),
  aadhaarNumber: z
    .string()
    .regex(/^\d{12}$/, "Aadhaar must be 12 digits")
    .optional()
    .or(z.literal("")),
  profession: z.string().max(100).optional().or(z.literal("")),
  companyName: z.string().max(200).optional().or(z.literal("")),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request);
  if ("error" in auth) return auth.error;

  const { id } = await params;

  try {
    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { name, email, title, altPhone, address, city, state, pincode, panNumber, aadhaarNumber, profession, companyName } = parsed.data;

    const customer = await prisma.customer.findUnique({ where: { id }, include: { user: true } });
    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    const [updatedCustomer] = await prisma.$transaction([
      prisma.customer.update({
        where: { id },
        data: {
          title: title || null,
          name,
          email: email || null,
          altPhone: altPhone || null,
          address: address || null,
          city: city || null,
          state: state || null,
          pincode: pincode || null,
          panNumber: panNumber || null,
          aadhaarNumber: aadhaarNumber || null,
          profession: profession || null,
          companyName: companyName || null,
        },
      }),
      prisma.user.update({
        where: { id: customer.userId },
        data: { email: email || null },
      }),
    ]);

    return NextResponse.json({
      id: updatedCustomer.id,
      title: updatedCustomer.title,
      name: updatedCustomer.name,
      email: updatedCustomer.email,
      altPhone: updatedCustomer.altPhone,
      address: updatedCustomer.address,
      city: updatedCustomer.city,
      state: updatedCustomer.state,
      pincode: updatedCustomer.pincode,
      panNumber: updatedCustomer.panNumber,
      aadhaarNumber: updatedCustomer.aadhaarNumber,
      profession: updatedCustomer.profession,
      companyName: updatedCustomer.companyName,
    });
  } catch (error) {
    console.error("Update customer error:", error);
    return NextResponse.json({ error: "Failed to update customer" }, { status: 500 });
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request);
  if ("error" in auth) return auth.error;

  const { id } = await params;

  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      user: { select: { phone: true, email: true, role: true, createdAt: true, lastLoginAt: true } },
      bookings: {
        include: {
          unit: { include: { project: true } },
          paymentSchedule: { orderBy: { instalmentNo: "asc" } },
          payments: { orderBy: { paymentDate: "desc" } },
          coApplicants: true,
        },
        orderBy: { bookingDate: "desc" },
      },
    },
  });

  if (!customer) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  const bookings = customer.bookings.map((b) => {
    const totalPaid = b.payments.reduce((sum, p) => sum + Number(p.amount), 0);
    const totalInterest = b.paymentSchedule
      .filter((s) => s.status !== "PAID")
      .reduce((sum, s) => sum + Number(s.interestAmount ?? 0), 0);
    const overdueCount = b.paymentSchedule.filter((s) => s.status === "OVERDUE").length;

    return {
      id: b.id,
      bookingRef: b.bookingRef,
      bookingDate: b.bookingDate.toISOString(),
      totalAmount: Number(b.totalAmount),
      totalPaid,
      totalDue: Number(b.totalAmount) - totalPaid + totalInterest,
      status: b.status,
      lateFeeRatePct: Number(b.lateFeeRatePct ?? 2),
      unit: {
        unitNumber: b.unit.unitNumber,
        unitType: b.unit.unitType,
        areaSqFt: b.unit.areaSqFt,
        floor: b.unit.floor,
        project: {
          name: b.unit.project.name,
          city: b.unit.project.city,
          state: b.unit.project.state,
        },
      },
      coApplicants: b.coApplicants.map((ca) => ({
        name: ca.name,
        phone: ca.phone,
        relationship: ca.relationship,
      })),
      overdueCount,
      schedule: b.paymentSchedule.map((s) => ({
        id: s.id,
        instalmentNo: s.instalmentNo,
        label: s.label,
        dueDate: s.dueDate.toISOString(),
        amount: Number(s.amount),
        interestAmount: Number(s.interestAmount ?? 0),
        status: s.status,
        escalationStage: s.escalationStage ?? 0,
      })),
    };
  });

  return NextResponse.json({
    id: customer.id,
    name: customer.name,
    title: customer.title,
    phone: customer.phone,
    altPhone: customer.altPhone,
    email: customer.email,
    address: customer.address,
    city: customer.city,
    state: customer.state,
    pincode: customer.pincode,
    panNumber: customer.panNumber,
    aadhaarNumber: customer.aadhaarNumber,
    profession: customer.profession,
    companyName: customer.companyName,
    createdAt: customer.createdAt.toISOString(),
    user: customer.user,
    bookings,
  });
}
