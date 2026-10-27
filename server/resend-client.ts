import { Resend } from "resend";

export async function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("Email is not configured: RESEND_API_KEY is required");
  return {
    client: new Resend(apiKey),
    fromEmail: process.env.RESEND_FROM_EMAIL || "noreply@moodboard.co.id",
  };
}
