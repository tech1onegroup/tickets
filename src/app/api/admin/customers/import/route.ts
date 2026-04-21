import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";

function normalizePhone(raw: string): string | null {
  let s = raw.replace(/^'/, "").replace(/[\s\-().]/g, "");
  if (s.startsWith("+91")) s = s.slice(3);
  else if (s.startsWith("91") && s.length === 12) s = s.slice(2);
  if (/^[6-9]\d{9}$/.test(s)) return s;
  return null;
}

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  for (const line of lines) {
    if (!line.trim()) continue;
    const fields: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (ch === "," && !inQuotes) {
        fields.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    fields.push(current.trim());
    rows.push(fields);
  }
  return rows;
}

async function getOrCreateProject(name: string, subProject: string | null) {
  const existing = await prisma.project.findFirst({
    where: { name, ...(subProject ? { subProject } : {}) },
  });
  if (existing) return existing;
  return prisma.project.create({
    data: {
      name,
      subProject: subProject || null,
      city: "",
      state: "",
      type: "RESIDENTIAL",
      status: "ONGOING",
    },
  });
}

async function getOrCreateUnit(projectId: string, unitNumber: string) {
  const existing = await prisma.unit.findFirst({
    where: { projectId, unitNumber },
  });
  if (existing) return existing;
  return prisma.unit.create({
    data: {
      projectId,
      unitNumber,
      unitType: "Flat",
      totalPrice: 0,
      status: "BOOKED",
    },
  });
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if ("error" in auth) return auth.error;

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file uploaded" }, { status: 400 });

    const text = await file.text();
    const rows = parseCSV(text);
    if (rows.length < 2) return NextResponse.json({ error: "CSV appears empty" }, { status: 400 });

    const headers = rows[0].map((h) => h.toLowerCase().trim());
    const col = (names: string[]) => {
      for (const n of names) {
        const i = headers.findIndex((h) => h.includes(n));
        if (i !== -1) return i;
      }
      return -1;
    };

    const iName     = col(["party name", "name"]);
    const iLocation = col(["location", "city"]);
    const iEmail    = col(["e-mail", "email"]);
    const iMobile   = col(["mobile", "phone"]);
    const iProject  = col(["project name", "project"]);
    const iSubProj  = col(["sub project", "subproject"]);
    const iUnit     = col(["unit no", "unit"]);

    if (iName === -1 || iMobile === -1) {
      return NextResponse.json(
        { error: "Could not find required columns (Party Name, Mobile No.)" },
        { status: 400 }
      );
    }

    const batchId = `import-${Date.now()}`;
    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const rawName  = iName   !== -1 ? row[iName]  : "";
      if (!rawName?.trim()) { skipped++; continue; }

      const name        = rawName.trim();
      const rawPhone    = iMobile !== -1 ? (row[iMobile] || "") : "";
      const email       = iEmail    !== -1 ? (row[iEmail]?.trim()    || null) : null;
      const city        = iLocation !== -1 ? (row[iLocation]?.trim() || null) : null;
      const projectName = iProject  !== -1 ? (row[iProject]?.trim()  || null) : null;
      const subProject  = iSubProj  !== -1 ? (row[iSubProj]?.trim()  || null) : null;
      const unitNo      = iUnit     !== -1 ? (row[iUnit]?.trim()     || null) : null;

      const phone = normalizePhone(rawPhone);

      // Need at least phone or email to create a meaningful record
      if (!phone && !email) { skipped++; continue; }

      // If phone is invalid (not blank, but unparseable like scientific notation) — skip with error
      if (rawPhone.trim() && !phone) {
        errors.push(`Row ${i + 1}: invalid phone "${rawPhone}" for "${name}"`);
        continue;
      }

      try {
        // Check duplicate: by phone if present, else by email
        if (phone) {
          const existing = await prisma.user.findUnique({ where: { phone } });
          if (existing) { skipped++; continue; }
        } else if (email) {
          const existing = await prisma.user.findFirst({ where: { email } });
          if (existing) { skipped++; continue; }
        }

        await prisma.$transaction(async (tx) => {
          const user = await tx.user.create({
            data: { phone: phone || null, email: email || null, role: "CUSTOMER" },
          });
          const customer = await tx.customer.create({
            data: { userId: user.id, name, phone: phone || null, email: email || null, city },
          });

          if (projectName && unitNo) {
            const project = await getOrCreateProject(projectName, subProject);
            const unit    = await getOrCreateUnit(project.id, unitNo);
            const bookingRef = `IMP-${phone || email}-${unitNo}`.replace(/[^A-Z0-9\-]/gi, "-");
            const existingBooking = await prisma.booking.findUnique({ where: { bookingRef } });
            if (!existingBooking) {
              await tx.booking.create({
                data: {
                  bookingRef,
                  customerId: customer.id,
                  unitId: unit.id,
                  bookingDate: new Date(),
                  totalAmount: 0,
                  status: "ACTIVE",
                  importBatchId: batchId,
                },
              });
            }
          }
        });

        imported++;
      } catch (err) {
        errors.push(`Row ${i + 1}: "${name}" — ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return NextResponse.json({ imported, skipped, errors: errors.slice(0, 20), totalErrors: errors.length });
  } catch (err) {
    console.error("CSV import error:", err);
    return NextResponse.json({ error: "Import failed" }, { status: 500 });
  }
}
