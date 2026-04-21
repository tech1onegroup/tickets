import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";

// One-time migration: customers imported with "Project | SubProject | UnitNo"
// jammed into the address field. Parse it and create proper booking records.
async function getOrCreateProject(name: string, subProject: string | null) {
  const existing = await prisma.project.findFirst({
    where: { name, ...(subProject ? { subProject } : {}) },
  });
  if (existing) return existing;
  return prisma.project.create({
    data: { name, subProject: subProject || null, city: "", state: "", type: "RESIDENTIAL", status: "ONGOING" },
  });
}

async function getOrCreateUnit(projectId: string, unitNumber: string) {
  const existing = await prisma.unit.findFirst({ where: { projectId, unitNumber } });
  if (existing) return existing;
  return prisma.unit.create({
    data: { projectId, unitNumber, unitType: "Flat", totalPrice: 0, status: "BOOKED" },
  });
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if ("error" in auth) return auth.error;

  // Find all customers whose address has the "X | Y | Z" import artifact
  const customers = await prisma.customer.findMany({
    where: { address: { contains: " | " } },
    include: { bookings: true },
  });

  let fixed = 0;
  let alreadyOk = 0;
  const errors: string[] = [];

  for (const customer of customers) {
    if (!customer.address) continue;
    const parts = customer.address.split(" | ").map((s) => s.trim());
    // Expected format: "ProjectName | SubProject | UnitNo"
    const [projectName, subProject, unitNo] = parts;
    if (!projectName || !unitNo) {
      errors.push(`${customer.name}: could not parse address "${customer.address}"`);
      continue;
    }

    // Skip if booking already exists for this customer + unit combo
    const bookingRef = `IMP-${customer.phone}-${unitNo}`.replace(/[^A-Z0-9\-]/gi, "-");
    const existingBooking = await prisma.booking.findUnique({ where: { bookingRef } });
    if (existingBooking) { alreadyOk++; continue; }

    try {
      const project = await getOrCreateProject(projectName, subProject || null);
      const unit    = await getOrCreateUnit(project.id, unitNo);

      await prisma.$transaction([
        prisma.booking.create({
          data: {
            bookingRef,
            customerId: customer.id,
            unitId: unit.id,
            bookingDate: customer.createdAt,
            totalAmount: 0,
            status: "ACTIVE",
            importBatchId: "fix-bookings-migration",
          },
        }),
        // Clear the address field now that it's stored properly
        prisma.customer.update({
          where: { id: customer.id },
          data: { address: null },
        }),
      ]);

      fixed++;
    } catch (err) {
      errors.push(`${customer.name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return NextResponse.json({ fixed, alreadyOk, errors: errors.slice(0, 30), totalErrors: errors.length });
}
