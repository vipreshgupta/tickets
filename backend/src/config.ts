import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url("DATABASE_URL must be a valid connection string"),

  // Redis
  REDIS_URL: z.string().min(1, "REDIS_URL is required").default("redis://localhost:6379"),

  // Auth
  JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 characters"),
  JWT_EXPIRES_IN: z.string().default("7d"),

  // HMAC for QR codes
  HMAC_SECRET: z.string().min(16, "HMAC_SECRET must be at least 16 characters"),

  // Server
  PORT: z.coerce.number().default(3001),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  FRONTEND_URL: z.string().default("http://localhost:3000"),

  // Storage
  STORAGE_PATH: z.string().default("./storage"),

  // Limits
  MAX_UPLOAD_SIZE_MB: z.coerce.number().default(10),
  MAX_BATCH_QUANTITY: z.coerce.number().default(5000),
  BATCH_EXPIRY_DAYS: z.coerce.number().default(7),

  // Rate limiting
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(3600000), // 1 hour
  RATE_LIMIT_MAX_BATCHES: z.coerce.number().default(500),
});

function loadConfig() {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    console.error("❌ Invalid environment variables:");
    for (const issue of parsed.error.issues) {
      console.error(`   ${issue.path.join(".")}: ${issue.message}`);
    }
    process.exit(1);
  }

  return parsed.data;
}

export const config = loadConfig();
export type Config = z.infer<typeof envSchema>;
