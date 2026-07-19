import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import { createSessionToken, safeUser, sessionCookie } from "@/server/auth/session";
import { validateTelegramInitData } from "@/server/auth/telegram";
import { getDb } from "@/server/db";
import { users } from "@/server/db/schema";
import { getAdminTelegramIds } from "@/server/env";
import { ApiError, apiError, readJson } from "@/server/http";
import { enforceRateLimit, requestIp } from "@/server/rate-limit";

const inputSchema = z.object({ initData: z.string().min(1).max(20_000) });

type AuthStage =
  | "request"
  | "configuration"
  | "rate_limit"
  | "telegram_validation"
  | "admin_configuration"
  | "database"
  | "session";

function unexpectedAuthError(stage: AuthStage) {
  switch (stage) {
    case "rate_limit":
      return new ApiError(
        503,
        "Не удалось проверить лимит запросов. Проверьте таблицу rate_limit_entries и миграции Railway",
        "AUTH_RATE_LIMIT_DATABASE_ERROR",
      );
    case "database":
      return new ApiError(
        503,
        "Не удалось сохранить пользователя. Проверьте таблицу users, DATABASE_URL и миграции Railway",
        "AUTH_USER_DATABASE_ERROR",
      );
    case "session":
      return new ApiError(
        503,
        "Не удалось создать сессию авторизации. Проверьте SESSION_SECRET",
        "AUTH_SESSION_ERROR",
      );
    default:
      return new ApiError(
        500,
        `Ошибка Telegram-авторизации на этапе ${stage}`,
        "TELEGRAM_AUTH_INTERNAL_ERROR",
      );
  }
}

export async function POST(request: Request) {
  const requestId = randomUUID();
  let stage: AuthStage = "request";

  try {
    const { initData } = inputSchema.parse(await readJson(request));

    stage = "configuration";
    const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
    if (!botToken) {
      throw new ApiError(
        503,
        "На сервере не настроен TELEGRAM_BOT_TOKEN",
        "TELEGRAM_BOT_TOKEN_MISSING",
      );
    }
    if (!/^\d+:[A-Za-z0-9_-]+$/.test(botToken)) {
      throw new ApiError(
        503,
        "TELEGRAM_BOT_TOKEN имеет неверный формат. Получите новый токен у @BotFather",
        "TELEGRAM_BOT_TOKEN_INVALID_FORMAT",
      );
    }
    const sessionSecret = process.env.SESSION_SECRET;
    if (!sessionSecret || sessionSecret.length < 32) {
      throw new ApiError(
        503,
        "SESSION_SECRET отсутствует или короче 32 символов",
        "SESSION_SECRET_INVALID",
      );
    }
    if (!process.env.DATABASE_URL) {
      throw new ApiError(503, "На сервере не настроен DATABASE_URL", "DATABASE_URL_MISSING");
    }

    stage = "rate_limit";
    await enforceRateLimit("auth", requestIp(request), 20, 60);

    stage = "telegram_validation";
    const profile = validateTelegramInitData(initData, botToken);
    const telegramId = BigInt(profile.id);

    stage = "admin_configuration";
    let role: "admin" | "user";
    try {
      role = getAdminTelegramIds().has(telegramId) ? "admin" : "user";
    } catch {
      throw new ApiError(
        503,
        "TELEGRAM_ADMIN_IDS должен содержать только числовые ID через запятую либо быть пустым",
        "TELEGRAM_ADMIN_IDS_INVALID",
      );
    }

    stage = "database";
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

    stage = "session";
    const response = NextResponse.json({ user: safeUser(user) });
    response.headers.set("set-cookie", sessionCookie(createSessionToken(user.id)));
    return response;
  } catch (error) {
    if (error instanceof ApiError || error instanceof z.ZodError) {
      if (error instanceof ApiError && error.status >= 500) {
        console.error("Telegram auth configuration failed", {
          requestId,
          stage,
          code: error.code,
          message: error.message,
        });
      }
      return apiError(error, { requestId });
    }

    const diagnosticError = unexpectedAuthError(stage);
    console.error("Telegram auth failed", {
      requestId,
      stage,
      code: diagnosticError.code,
      cause: error instanceof Error ? error.message : "Unknown error",
    });
    return apiError(diagnosticError, { requestId });
  }
}
