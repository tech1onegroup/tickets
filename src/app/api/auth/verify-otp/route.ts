import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { signAccessToken, generateRefreshToken } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { z } from "zod";

const schema = z.object({
  phone: z.string().regex(/^[6-9]\d{9}$/, "Invalid phone number"),
  otp: z.string().length(6, "OTP must be 6 digits"),
});

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

    const { phone, otp } = parsed.data;

    // Find latest unverified OTP request
    const otpRequest = await prisma.otpRequest.findFirst({
      where: {
        phone,
        verified: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!otpRequest) {
      return NextResponse.json(
        { error: "OTP expired or not found. Request a new one." },
        { status: 400 }
      );
    }

    // Check max attempts
    if (otpRequest.attempts >= 5) {
      return NextResponse.json(
        { error: "Too many failed attempts. Request a new OTP." },
        { status: 429 }
      );
    }

    // Increment attempts
    await prisma.otpRequest.update({
      where: { id: otpRequest.id },
      data: { attempts: { increment: 1 } },
    });

    // Verify OTP
    const isValid = await bcrypt.compare(otp, otpRequest.otp);
    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid OTP" },
        { status: 400 }
      );
    }

    // Mark OTP as verified
    await prisma.otpRequest.update({
      where: { id: otpRequest.id },
      data: { verified: true },
    });

    // Only allow login for existing users (customer or admin).
    // Do NOT auto-create accounts from an OTP verification.
    const user = await prisma.user.findUnique({
      where: { phone },
      include: { customer: true },
    });
    const isAdmin = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";
    const isCustomer = Boolean(user?.customer);
    if (!user || !user.isActive || (!isCustomer && !isAdmin)) {
      return NextResponse.json(
        {
          error:
            "This phone number is not registered. Please contact ONE Group support.",
        },
        { status: 403 }
      );
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Generate tokens
    const accessToken = await signAccessToken({
      userId: user.id,
      phone: user.phone,
      role: user.role,
    });

    const refreshToken = generateRefreshToken();
    const refreshExpiryDays = parseInt(
      process.env.REFRESH_TOKEN_EXPIRY_DAYS || "30"
    );

    await prisma.session.create({
      data: {
        userId: user.id,
        token: refreshToken,
        expiresAt: new Date(
          Date.now() + refreshExpiryDays * 24 * 60 * 60 * 1000
        ),
      },
    });

    // Get customer profile if exists
    const customer = await prisma.customer.findUnique({
      where: { userId: user.id },
    });

    const response = NextResponse.json({
      success: true,
      accessToken,
      user: {
        id: user.id,
        phone: user.phone,
        role: user.role,
        name: customer?.name || null,
      },
    });

    // Set refresh token as httpOnly cookie
    response.cookies.set("refresh_token", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: refreshExpiryDays * 24 * 60 * 60,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Verify OTP error:", error);
    return NextResponse.json(
      { error: "Verification failed" },
      { status: 500 }
    );
  }
}
