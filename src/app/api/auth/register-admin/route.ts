import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const schema = z.object({
  phone: z.string().regex(/^[6-9]\d{9}$/, "Invalid Indian phone number"),
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  adminCode: z.string().min(1, "Admin code is required"),
});

const ADMIN_CODE = process.env.ADMIN_REGISTER_CODE || "ONEGROUP2025";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { phone, name, email, adminCode } = parsed.data;

    if (adminCode !== ADMIN_CODE) {
      return NextResponse.json(
        { error: "Invalid admin registration code" },
        { status: 403 }
      );
    }

    const existing = await prisma.user.findUnique({ where: { phone } });
    if (existing) {
      if (existing.role === "ADMIN" || existing.role === "SUPER_ADMIN") {
        // Admin already exists — update their email if a new one is provided.
        // This allows admins to link their Google account after initial registration.
        if (email) {
          // Make sure no other account already owns this email
          const emailConflict = await prisma.user.findFirst({
            where: { email, NOT: { phone } },
          });
          if (emailConflict) {
            return NextResponse.json(
              { error: "That email is already associated with another account." },
              { status: 400 }
            );
          }
          await prisma.user.update({
            where: { phone },
            data: { email },
          });
          return NextResponse.json({
            success: true,
            message: "Admin email updated. You can now login with Google.",
          });
        }
        return NextResponse.json(
          { error: "Admin account already exists for this phone. Provide an email to update it." },
          { status: 400 }
        );
      }
      // Don't overwrite existing customer accounts — create a separate admin account
      const hasCustomer = await prisma.customer.findUnique({ where: { userId: existing.id } });
      if (hasCustomer) {
        return NextResponse.json(
          { error: "This phone is registered as a customer. Use a different phone for admin access." },
          { status: 400 }
        );
      }
      await prisma.user.update({
        where: { phone },
        data: { role: "ADMIN", email: email || undefined },
      });
    } else {
      await prisma.user.create({
        data: { phone, role: "ADMIN", email: email || null },
      });
    }

    return NextResponse.json({
      success: true,
      message: "Admin account created. You can now login with OTP.",
    });
  } catch (error) {
    console.error("Register admin error:", error);
    return NextResponse.json(
      { error: "Registration failed" },
      { status: 500 }
    );
  }
}
