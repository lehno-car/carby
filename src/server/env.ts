import { z } from "zod";

const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1),
  APP_URL: z.url(),
  TELEGRAM_BOT_TOKEN: z.string().min(1),
  TELEGRAM_BOT_USERNAME: z.string().min(1),
  TELEGRAM_WEBAPP_URL: z.url(),
  TELEGRAM_ADMIN_IDS: z.string().default(""),
  TELEGRAM_WEBHOOK_SECRET: z.string().min(16),
  SESSION_SECRET: z.string().min(32),
  BUCKET: z.string().min(1),
  ACCESS_KEY_ID: z.string().min(1),
  SECRET_ACCESS_KEY: z.string().min(1),
  ENDPOINT: z.url(),
  REGION: z.string().default("auto"),
  S3_URL_STYLE: z.enum(["virtual", "path"]).default("virtual"),
  DEV_AUTH_ENABLED: z.enum(["true", "false"]).default("false"),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function getEnv(): ServerEnv {
  const result = serverEnvSchema.safeParse(process.env);
  if (!result.success) {
    throw new Error(`Invalid environment: ${z.prettifyError(result.error)}`);
  }
  return result.data;
}

export function getAdminTelegramIds(): Set<bigint> {
  return new Set(
    (process.env.TELEGRAM_ADMIN_IDS ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
      .map(BigInt),
  );
}
