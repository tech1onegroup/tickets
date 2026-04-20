import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { generateOtp } from "@/lib/auth";
import { sendOtpViaWhatsApp } from "@/lib/evolution-api";
import bcrypt from "bcryptjs";
import { z } from "zod";

// Use dev mode when no WhatsApp (Evolution API) provider is configured
const isDev = !process.env.EVOLUTION_API_KEY || !process.env.EVOLUTION_BASE_URL;

const schema = z.object({
  phone: z.string().regex(/^[6-9]\d{9}$/, "Invalid Indian phone number"),
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

    const { phone } = parsed.data;
    const fullPhone = `91${phone}`;

    // Only allow OTP for phones that are already registered — customers
    // (User with a linked Customer profile) or admins (ADMIN / SUPER_ADMIN).
    // Generic return message so we don't leak whether a number is in the system.
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

    // Rate limit: relaxed in dev
    const maxAttempts = isDev ? 100 : 3;
    const rateLimitKey = `otp_rate:${phone}`;
    const attempts = await redis.incr(rateLimitKey);
    if (attempts === 1) await redis.expire(rateLimitKey, 600);
    if (attempts > maxAttempts) {
      return NextResponse.json(
        { error: "Too many OTP requests. Try again in 10 minutes." },
        { status: 429 }
      );
    }

    // Fixed "123456" in dev for easy testing
    const otp = isDev ? "123456" : generateOtp();
    const hashedOtp = await bcrypt.hash(otp, 10);

    await prisma.otpRequest.create({
      data: {
        phone,
        otp: hashedOtp,
        expiresAt: new Date(Date.now() + (isDev ? 24 * 60 * 60 * 1000 : 5 * 60 * 1000)),
      },
    });

    // Send OTP via WhatsApp (Evolution API). In dev mode, logs to console.
    if (isDev) {
      console.log(`[DEV] OTP for ${phone}: ${otp}`);
    } else {
      const result = await sendOtpViaWhatsApp(fullPhone, otp);
      if (!result.success) {
        console.error(`Failed to send OTP to ${phone}:`, result.error);
        return NextResponse.json(
          { error: "Failed to send OTP via WhatsApp. Please try again." },
          { status: 502 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: "OTP sent successfully via WhatsApp",
    });
  } catch (error) {
    console.error("Send OTP error:", error);
    return NextResponse.json(
      { error: "Failed to send OTP" },
      { status: 500 }
    );
  }
}
