import { Router, Request, Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";
import { verifyHmacSignature } from "../utils/hmac.js";
import { createError } from "../middleware/errorHandler.js";

const router = Router();
const prisma = new PrismaClient();

/**
 * GET /verify?id=<ticket_id>&sig=<signature>
 * Public endpoint — verifies a ticket is authentic.
 */
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id, sig } = req.query;

    if (!id || typeof id !== "string" || !sig || typeof sig !== "string") {
      throw createError(400, "Missing id or sig query parameters", "INVALID_PARAMS");
    }

    // Verify HMAC signature
    let signatureValid = false;
    try {
      signatureValid = verifyHmacSignature(id, sig);
    } catch {
      signatureValid = false;
    }

    if (!signatureValid) {
      return res.json({
        verified: false,
        message: "Invalid verification signature. This ticket may be counterfeit.",
      });
    }

    // Look up ticket
    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: {
        batch: {
          select: {
            id: true,
            createdAt: true,
            quantity: true,
          },
        },
      },
    });

    if (!ticket) {
      return res.json({
        verified: false,
        message: "Ticket not found in the system.",
      });
    }

    res.json({
      verified: true,
      message: "This is an authentic, system-generated Tambola ticket.",
      ticket: {
        id: ticket.id,
        ticket_index: ticket.ticketIndex,
        numbers: ticket.numbers,
        batch_id: ticket.batchId,
        batch_created_at: ticket.batch.createdAt,
        batch_size: ticket.batch.quantity,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
