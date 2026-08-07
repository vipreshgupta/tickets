import multer from "multer";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { config } from "../config.js";
import { createError } from "./errorHandler.js";
import { Request } from "express";

const ALLOWED_MIMES = ["image/jpeg", "image/png"];
const MAX_SIZE = config.MAX_UPLOAD_SIZE_MB * 1024 * 1024;

const storage = multer.diskStorage({
  destination: (_req: Request, _file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) => {
    cb(null, path.join(config.STORAGE_PATH, "uploads"));
  },
  filename: (_req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uuidv4()}${ext}`);
  },
});

export const upload = multer({
  storage,
  limits: { fileSize: MAX_SIZE },
  fileFilter: (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    if (!ALLOWED_MIMES.includes(file.mimetype)) {
      cb(createError(400, "Only JPEG and PNG images are allowed", "INVALID_FILE_TYPE"));
      return;
    }
    cb(null, true);
  },
});
