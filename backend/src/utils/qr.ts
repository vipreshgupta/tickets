import QRCode from "qrcode";
import { config } from "../config.js";
import { generateHmacSignature } from "./hmac.js";

/**
 * Generate a QR code data URL for a ticket.
 * Encodes a verification URL with HMAC signature.
 */
export async function generateQrDataUrl(ticketId: string): Promise<string> {
  const signature = generateHmacSignature(ticketId);
  const verifyUrl = `${config.FRONTEND_URL}/verify?id=${ticketId}&sig=${signature}`;

  return QRCode.toDataURL(verifyUrl, {
    width: 120,
    margin: 1,
    color: {
      dark: "#000000",
      light: "#FFFFFF",
    },
    errorCorrectionLevel: "M",
  });
}

/**
 * Generate a QR code as a Buffer (PNG).
 */
export async function generateQrBuffer(ticketId: string): Promise<Buffer> {
  const signature = generateHmacSignature(ticketId);
  const verifyUrl = `${config.FRONTEND_URL}/verify?id=${ticketId}&sig=${signature}`;

  return QRCode.toBuffer(verifyUrl, {
    width: 120,
    margin: 1,
    color: {
      dark: "#000000",
      light: "#FFFFFF",
    },
    errorCorrectionLevel: "M",
  });
}
