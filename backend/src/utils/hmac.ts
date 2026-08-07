import crypto from "crypto";
import { config } from "../config.js";

/**
 * Generate an HMAC-SHA256 signature for a ticket ID.
 * Used for QR code verification URLs.
 */
export function generateHmacSignature(ticketId: string): string {
  return crypto
    .createHmac("sha256", config.HMAC_SECRET)
    .update(ticketId)
    .digest("hex");
}

/**
 * Verify an HMAC signature against a ticket ID.
 */
export function verifyHmacSignature(ticketId: string, signature: string): boolean {
  const expected = generateHmacSignature(ticketId);
  return crypto.timingSafeEqual(
    Buffer.from(expected, "hex"),
    Buffer.from(signature, "hex")
  );
}
