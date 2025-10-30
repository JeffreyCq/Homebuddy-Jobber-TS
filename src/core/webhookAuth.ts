import crypto from "crypto";

export function verifyJobberWebhook(rawBody: string, header: string | undefined): boolean {
  if (!header) return false;
  const secret = process.env.JOBBER_CLIENT_SECRET!;
  const digest = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest();
  const calculated = digest.toString("base64");
  try {
    return crypto.timingSafeEqual(Buffer.from(calculated), Buffer.from(header));
  } catch {
    return false;
  }
}