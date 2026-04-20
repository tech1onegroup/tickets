/**
 * Evolution API (evolution-go) integration for sending WhatsApp messages.
 * Used for OTP delivery — replaces paid MSG91 SMS.
 */

const EVOLUTION_BASE_URL = process.env.EVOLUTION_BASE_URL || "";
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || "";

export async function sendWhatsAppMessage(
  phone: string,
  text: string
): Promise<{ success: boolean; error?: string }> {
  if (!EVOLUTION_BASE_URL || !EVOLUTION_API_KEY) {
    console.log(`[DEV] WhatsApp would be sent to ${phone}: ${text}`);
    return { success: true };
  }

  try {
    const res = await fetch(`${EVOLUTION_BASE_URL}/send/text`, {
      method: "POST",
      headers: {
        apikey: EVOLUTION_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        number: phone,
        text,
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok || data?.message !== "success") {
      console.error("Evolution API send failed:", res.status, data);
      return { success: false, error: data?.error || `HTTP ${res.status}` };
    }

    return { success: true };
  } catch (err) {
    console.error("Evolution API error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

export async function sendOtpViaWhatsApp(
  phone: string,
  otp: string
): Promise<{ success: boolean; error?: string }> {
  const text =
    `*ONE Group — Verification Code*\n\n` +
    `Your OTP is: *${otp}*\n\n` +
    `This code is valid for 5 minutes. Do not share it with anyone.`;

  return sendWhatsAppMessage(phone, text);
}
