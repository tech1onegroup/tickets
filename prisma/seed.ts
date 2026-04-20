import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set");
console.log("DB:", connectionString.replace(/:[^:@]+@/, ":****@"));
const adapter = new PrismaPg({ connectionString }, { schema: "tickets" });
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  console.log("Seeding...");

  const admin = await prisma.user.create({ data: { phone: "9999999999", role: "ADMIN", email: "admin@onegroup.in" } });
  const cu1 = await prisma.user.create({ data: { phone: "9876543210", role: "CUSTOMER" } });
  const cu2 = await prisma.user.create({ data: { phone: "9876543211", role: "CUSTOMER" } });

  const p1 = await prisma.project.create({ data: { name: "The Clermont", subProject: "Phase 1", city: "Gurugram", state: "Haryana", sector: "Sector 91", type: "RESIDENTIAL", status: "ONGOING", reraNumber: "RERA-HR-GGM-2024-0042", expectedCompletion: new Date("2027-06-30"), description: "Premium independent floors" } });
  await prisma.project.create({ data: { name: "One City Hub", city: "Gurugram", state: "Haryana", type: "COMMERCIAL", status: "ONGOING" } });

  const u1 = await prisma.unit.create({ data: { projectId: p1.id, unitNumber: "B-61/04", unitType: "Independent Floor", floor: 2, areaSqFt: 1850, basePricePSF: 8500, totalPrice: 15725000, paymentPlanType: "DOWN_PAYMENT", possessionDate: new Date("2027-03-31") } });
  const u2 = await prisma.unit.create({ data: { projectId: p1.id, unitNumber: "C-22/01", unitType: "Plot", areaSqFt: 2400, basePricePSF: 12000, totalPrice: 28800000, paymentPlanType: "CONSTRUCTION_LINKED", possessionDate: new Date("2027-06-30") } });

  const c1 = await prisma.customer.create({ data: { userId: cu1.id, title: "Mr.", name: "Rajesh Kumar Sharma", email: "rajesh@gmail.com", phone: "9876543210", address: "45, Model Town", city: "Delhi", state: "Delhi", pincode: "110009", panNumber: "ABCPS1234K", profession: "Business Owner", companyName: "Sharma Enterprises" } });
  const c2 = await prisma.customer.create({ data: { userId: cu2.id, title: "Mrs.", name: "Priya Mehta", email: "priya@outlook.com", phone: "9876543211", address: "B-12, Green Park", city: "Delhi", state: "Delhi", pincode: "110016", profession: "Software Engineer" } });

  const b1 = await prisma.booking.create({ data: { bookingRef: "B-61/04", customerId: c1.id, unitId: u1.id, bookingDate: new Date("2025-08-15"), totalAmount: 15725000, source: "Walk-in" } });
  const b2 = await prisma.booking.create({ data: { bookingRef: "C-22/01", customerId: c2.id, unitId: u2.id, bookingDate: new Date("2025-10-01"), totalAmount: 28800000, source: "Referral", sourceName: "Rajesh" } });
  await prisma.coApplicant.create({ data: { bookingId: b1.id, name: "Sunita Sharma", phone: "9876543201", relationship: "Spouse" } });

  for (const s of [
    { no:1, l:"Booking Amount", d:"2025-08-15", a:500000, st:"PAID" },
    { no:2, l:"Within 30 Days", d:"2025-09-15", a:2500000, st:"PAID" },
    { no:3, l:"On Foundation", d:"2025-12-15", a:2000000, st:"PAID" },
    { no:4, l:"On Structure", d:"2026-03-15", a:2500000, st:"PAID" },
    { no:5, l:"On Brickwork", d:"2026-06-15", a:2000000, st:"UPCOMING" },
    { no:6, l:"On Plastering", d:"2026-09-15", a:2000000, st:"UPCOMING" },
    { no:7, l:"On Flooring", d:"2026-12-15", a:2000000, st:"UPCOMING" },
    { no:8, l:"On Possession", d:"2027-03-15", a:2225000, st:"UPCOMING" },
  ]) {
    const sc = await prisma.paymentSchedule.create({ data: { bookingId: b1.id, instalmentNo: s.no, label: s.l, dueDate: new Date(s.d), amount: s.a, status: s.st } });
    if (s.st === "PAID") await prisma.payment.create({ data: { bookingId: b1.id, scheduleId: sc.id, amount: s.a, paymentDate: new Date(s.d), paymentMode: "NEFT", referenceNumber: "TXN"+s.no, markedBy: admin.id } });
  }
  for (const s of [
    { no:1, l:"Booking Amount", d:"2025-10-01", a:1000000, st:"PAID" },
    { no:2, l:"Within 45 Days", d:"2025-11-15", a:5000000, st:"PAID" },
    { no:3, l:"On Construction", d:"2026-01-15", a:4000000, st:"OVERDUE" },
    { no:4, l:"On Foundation", d:"2026-06-15", a:5000000, st:"UPCOMING" },
    { no:5, l:"On Structure", d:"2026-10-15", a:5000000, st:"UPCOMING" },
    { no:6, l:"On Possession", d:"2026-12-31", a:8800000, st:"UPCOMING" },
  ]) {
    const sc = await prisma.paymentSchedule.create({ data: { bookingId: b2.id, instalmentNo: s.no, label: s.l, dueDate: new Date(s.d), amount: s.a, status: s.st } });
    if (s.st === "PAID") await prisma.payment.create({ data: { bookingId: b2.id, scheduleId: sc.id, amount: s.a, paymentDate: new Date(s.d), paymentMode: "RTGS", referenceNumber: "TXN"+s.no, markedBy: admin.id } });
  }

  for (const u of [
    { t:"Site Clearing", s:"FOUNDATION", d:"2025-09-01" }, { t:"Foundation Started", s:"FOUNDATION", d:"2025-10-15" },
    { t:"Foundation Complete", s:"FOUNDATION", d:"2025-12-20" }, { t:"Structure Progress", s:"STRUCTURE", d:"2026-02-10" },
    { t:"Structure Complete", s:"STRUCTURE", d:"2026-03-25" }, { t:"Brickwork Started", s:"BRICKWORK", d:"2026-04-05" },
  ]) {
    await prisma.constructionUpdate.create({ data: { projectId: p1.id, title: u.t, stage: u.s, date: new Date(u.d), mediaType: "PHOTO", mediaUrl: "https://placehold.co/800x600/e2e8f0/475569?text="+encodeURIComponent(u.t), source: "MANUAL" } });
  }

  for (const d of [
    { name: "Booking Form", file: "Booking-Form-B6104.pdf" },
    { name: "Allotment Letter", file: "Allotment-Letter-B6104.pdf" },
    { name: "Agreement to Sell", file: "Agreement-to-Sell-B6104.pdf" },
    { name: "Demand Letter", file: "Demand-Letter-B6104.pdf" },
  ]) {
    await prisma.document.create({ data: { customerId: c1.id, bookingId: b1.id, type: "BOOKING_FORM", title: d.name+" - B-61/04", fileUrl: `/uploads/documents/${d.file}`, fileSize: 256000, mimeType: "application/pdf", uploadedBy: "ADMIN" } });
  }

  await prisma.ticket.create({ data: { ticketRef: "TKT-001", customerId: c1.id, category: "PAYMENT_DISPUTE", subject: "Amount clarification", description: "Demand letter vs plan mismatch", status: "IN_PROGRESS", priority: "HIGH", assignedTo: admin.id, messages: { create: [{ senderId: cu1.id, message: "Check demand letter" },{ senderId: admin.id, message: "Looking into it" }] } } });
  await prisma.ticket.create({ data: { ticketRef: "TKT-002", customerId: c1.id, category: "CONSTRUCTION_QUERY", subject: "Structure date?", description: "When Block B?", status: "OPEN", priority: "MEDIUM" } });
  await prisma.ticket.create({ data: { ticketRef: "TKT-003", customerId: c2.id, category: "NAME_CHANGE", subject: "Add co-applicant", description: "Add husband", status: "RESOLVED", priority: "MEDIUM", resolvedAt: new Date("2026-04-09"), messages: { create: [{ senderId: cu2.id, message: "Add co-applicant" },{ senderId: admin.id, message: "Done" }] } } });

  for (const n of [
    { c:c1.id, t:"PAYMENT_CONFIRMATION", ti:"Payment Received", b:"4th instalment ₹25L received", r:true },
    { c:c1.id, t:"CONSTRUCTION_UPDATE", ti:"Construction Update", b:"Brickwork started Block B", r:false },
    { c:c1.id, t:"PAYMENT_REMINDER", ti:"Due in 7 Days", b:"5th instalment ₹20L due 15 Jun", r:false },
    { c:c2.id, t:"PAYMENT_REMINDER", ti:"Overdue", b:"3rd instalment ₹40L overdue", r:false },
  ]) {
    await prisma.notification.create({ data: { customerId: n.c, type: n.t, title: n.ti, body: n.b, channels: "IN_APP,SMS", isRead: n.r, sentAt: new Date() } });
  }

  await prisma.referral.create({ data: { referrerId: c1.id, referralCode: "RAJESH-2025", refereeName: "Priya Mehta", refereePhone: "9876543211", status: "BOOKING", rewardAmount: 100000 } });
  await prisma.referral.create({ data: { referrerId: c1.id, referralCode: "RAJESH-2026", refereeName: "Vikram Singh", refereePhone: "9876543212", status: "SITE_VISIT" } });
  await prisma.referral.create({ data: { referrerId: c1.id, referralCode: "RAJESH-2026B", refereeName: "Neha Gupta", refereePhone: "9876543213", status: "LEAD" } });

  for (const s of [
    { n:1, t:"Structure Complete", st:"DONE", e:"2026-03-31", c:"2026-03-25" },
    { n:2, t:"Internal Finishing", st:"IN_PROGRESS", e:"2026-09-30", c:null },
    { n:3, t:"External Development", st:"UPCOMING", e:"2026-12-31", c:null },
    { n:4, t:"OC Applied", st:"UPCOMING", e:"2027-01-15", c:null },
    { n:5, t:"OC Received", st:"UPCOMING", e:"2027-02-15", c:null },
    { n:6, t:"Possession Announced", st:"UPCOMING", e:"2027-02-28", c:null },
    { n:7, t:"Registry Guidance", st:"UPCOMING", e:"2027-03-15", c:null },
  ]) {
    await prisma.possessionStep.create({ data: { bookingId: b1.id, stepNumber: s.n, title: s.t, status: s.st, estimatedDate: new Date(s.e), completedDate: s.c ? new Date(s.c) : null } });
  }

  await prisma.announcement.create({ data: { projectId: p1.id, title: "Diwali at Site", body: "Join us 20th Oct!" } });
  await prisma.announcement.create({ data: { projectId: p1.id, title: "Milestone", body: "Structure done, brickwork started" } });
  for (const f of [{ q:"When possession?", a:"March 2027", c:"Possession" },{ q:"Amenities?", a:"Club,pool,gym,garden", c:"Amenities" },{ q:"Site visits?", a:"Saturday 10-4", c:"General" }]) {
    await prisma.faq.create({ data: { projectId: p1.id, question: f.q, answer: f.a, category: f.c } });
  }
  await prisma.event.create({ data: { projectId: p1.id, title: "Site Visit", eventDate: new Date("2026-04-20"), location: "Sector 91" } });
  await prisma.event.create({ data: { projectId: p1.id, title: "Buyer Meetup", eventDate: new Date("2026-05-10"), location: "Sector 44" } });

  for (const b of [
    { n:"HDFC", r:8.75, m:50000000, f:"0.5%", cp:"Arun", ph:"9811234567" },
    { n:"SBI", r:8.50, m:100000000, f:"₹10K", cp:"Meera", ph:"9811234568" },
    { n:"ICICI", r:8.85, m:50000000, f:"0.5%+GST", cp:"Rahul", ph:"9811234569" },
  ]) {
    await prisma.partnerBank.create({ data: { bankName: b.n, interestRate: b.r, maxLoanAmount: b.m, processingFee: b.f, contactPerson: b.cp, contactPhone: b.ph, documentChecklist: JSON.stringify(["PAN","Aadhaar","Statements","ITR"]) } });
  }

  const hash = await bcrypt.hash("123456", 10);
  await prisma.otpRequest.create({ data: { phone: "9876543210", otp: hash, expiresAt: new Date(Date.now()+365*24*60*60*1000) } });
  await prisma.otpRequest.create({ data: { phone: "9999999999", otp: hash, expiresAt: new Date(Date.now()+365*24*60*60*1000) } });

  console.log("\nDone! Login:");
  console.log("  Customer: 9876543210 / 123456");
  console.log("  Admin:    9999999999 / 123456");
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
