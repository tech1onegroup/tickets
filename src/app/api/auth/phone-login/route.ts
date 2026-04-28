import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { signAccessToken, generateRefreshToken } from "@/lib/auth";
import { z } from "zod";

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

    const user = await prisma.user.findUnique({
      where: { phone },
      include: { customer: true },
    });

    const isAdmin = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";
    const isCustomer = Boolean(user?.customer);

    // Admins must use OTP — only registered customers can use direct phone login
    if (!user || !user.isActive || !isCustomer || isAdmin) {
      return NextResponse.json(
        {
          error:
            "This phone number is not registered. Please contact ONE Group support.",
        },
        { status: 403 }
      );
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

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

    const response = NextResponse.json({
      success: true,
      accessToken,
      user: {
        id: user.id,
        phone: user.phone,
        role: user.role,
        name: user.customer?.name || null,
      },
    });

    response.cookies.set("refresh_token", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: refreshExpiryDays * 24 * 60 * 60,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Phone login error:", error);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
