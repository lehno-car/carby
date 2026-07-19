import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import { createSessionToken, safeUser, sessionCookie } from "@/server/auth/session";
import { telegramLoginSchema, validateTelegramLoginData } from "@/server/auth/telegram";
import { getDb } from "@/server/db";
import { users } from "@/server/db/schema";
import { getAdminTelegramIds } from "@/server/env";
import { ApiError, apiError, readJson } from "@/server/http";
import { enforceRateLimit, requestIp } from "@/server/rate-limit";

export async function POST(request: Request) {
  const requestId = randomUUID();

  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
    if (!botToken) {
      throw new ApiError(503, "На сервере не настроен TELEGRAM_BOT_TOKEN", "TELEGRAM_BOT_TOKEN_MISSING");
    }
    if (!process.env.DATABASE_URL) {
      throw new ApiError(503, "На сервере не настроен DATABASE_URL", "DATABASE_URL_MISSING");
    }
    const sessionSecret = process.env.SESSION_SECRET;
    if (!sessionSecret || sessionSecret.length < 32) {
      throw new ApiError(503, "SESSION_SECRET отсутствует или короче 32 символов", "SESSION_SECRET_INVALID");
    }

    await enforceRateLimit("auth:telegram-login", requestIp(request), 20, 60);

    const data = telegramLoginSchema.parse(await readJson(request));
    const profile = validateTelegramLoginData(data, botToken);
    const telegramId = BigInt(profile.id);
    const role = getAdminTelegramIds().has(telegramId) ? "admin" : "user";

    const [user] = await getDb()
      .insert(users)
      .values({
        telegramId,
        username: profile.username,
        firstName: profile.first_name,
        lastName: profile.last_name,
        photoUrl: profile.photo_url,
        role,
      })
      .onConflictDoUpdate({
        target: users.telegramId,
        set: {
          username: profile.username,
          firstName: profile.first_name,
          lastName: profile.last_name,
          photoUrl: profile.photo_url,
          role,
          updatedAt: new Date(),
        },
      })
      .returning();
    if (!user) throw new Error("User upsert failed");

    const response = NextResponse.json({ user: safeUser(user) });
    response.headers.set("set-cookie", sessionCookie(createSessionToken(user.id)));
    return response;
  } catch (error) {
    if (!(error instanceof ApiError || error instanceof z.ZodError)) {
      console.error("Telegram browser login failed", {
        requestId,
        cause: error instanceof Error ? error.message : "Unknown error",
      });
    }
    return apiError(error, { requestId });
  }
}
