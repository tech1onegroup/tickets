import { SignJWT, jwtVerify } from "jose";

const DEFAULT_SECRET = "dev-secret-change-in-production";

if (
  process.env.NODE_ENV === "production" &&
  (!process.env.JWT_SECRET || process.env.JWT_SECRET === DEFAULT_SECRET)
) {
  throw new Error(
    "JWT_SECRET must be set to a secure value in production. Do not use the default secret."
  );
}

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || DEFAULT_SECRET
);

export interface JWTPayload {
  userId: string;
  phone: string | null;
  role: string;
}

export async function signAccessToken(payload: JWTPayload): Promise<string> {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(process.env.JWT_EXPIRY || "24h")
    .sign(JWT_SECRET);
}

export async function verifyAccessToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as JWTPayload;
  } catch {
    return null;
  }
}

export function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function generateRefreshToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
}
