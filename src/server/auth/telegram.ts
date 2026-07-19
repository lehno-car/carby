import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

import { ApiError } from "@/server/http";

const telegramUserSchema = z.object({
  id: z.number().int().positive(),
  first_name: z.string().min(1).max(128),
  last_name: z.string().max(128).optional(),
  username: z.string().max(64).optional(),
  photo_url: z.url().optional(),
});

export type TelegramUser = z.infer<typeof telegramUserSchema>;

export function validateTelegramInitData(
  initData: string,
  botToken: string,
  maxAgeSeconds = 3600,
  nowSeconds = Math.floor(Date.now() / 1000),
): TelegramUser {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  const authDateValue = params.get("auth_date");
  const userValue = params.get("user");

  if (!hash || !authDateValue || !userValue) {
    throw new ApiError(401, "Неполные данные Telegram", "INVALID_INIT_DATA");
  }

  const authDate = Number(authDateValue);
  if (!Number.isInteger(authDate) || authDate > nowSeconds + 30) {
    throw new ApiError(401, "Некорректное время авторизации", "INVALID_AUTH_DATE");
  }
  if (nowSeconds - authDate > maxAgeSeconds) {
    throw new ApiError(401, "Сессия Telegram истекла", "EXPIRED_INIT_DATA");
  }

  const dataCheckString = [...params.entries()]
    .filter(([key]) => key !== "hash")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest();
  const expected = createHmac("sha256", secretKey).update(dataCheckString).digest();

  let received: Buffer;
  try {
    received = Buffer.from(hash, "hex");
  } catch {
    throw new ApiError(401, "Некорректная подпись Telegram", "INVALID_SIGNATURE");
  }
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    throw new ApiError(401, "Подпись Telegram не прошла проверку", "INVALID_SIGNATURE");
  }

  try {
    return telegramUserSchema.parse(JSON.parse(userValue));
  } catch {
    throw new ApiError(401, "Некорректный профиль Telegram", "INVALID_TELEGRAM_USER");
  }
}
