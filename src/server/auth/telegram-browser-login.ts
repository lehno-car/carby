import { randomBytes } from "node:crypto";

import { and, eq, gt, lt } from "drizzle-orm";

import { createSessionToken, safeUser, sessionCookie } from "@/server/auth/session";
import { getDb } from "@/server/db";
import { telegramLoginRequests, users } from "@/server/db/schema";
import { getAdminTelegramIds } from "@/server/env";
import { ApiError } from "@/server/http";

export const TELEGRAM_LOGIN_COOKIE = "carby_telegram_login";
export const TELEGRAM_LOGIN_TTL_SECONDS = 10 * 60;

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function createTelegramLoginToken() {
  return randomBytes(32).toString("base64url");
}

export function telegramBotUsername() {
  const username = process.env.TELEGRAM_BOT_USERNAME?.trim().replace(/^@/, "");
  if (!username) {
    throw new ApiError(
      503,
      "На сервере не настроен TELEGRAM_BOT_USERNAME",
      "TELEGRAM_BOT_USERNAME_MISSING",
    );
  }
  if (!/^[A-Za-z0-9_]{5,32}$/.test(username)) {
    throw new ApiError(
      503,
      "TELEGRAM_BOT_USERNAME имеет неверный формат",
      "TELEGRAM_BOT_USERNAME_INVALID",
    );
  }
  return username;
}

export function telegramLoginLink(token: string, username = telegramBotUsername()) {
  if (!TOKEN_PATTERN.test(token)) {
    throw new ApiError(400, "Некорректный токен входа", "TELEGRAM_LOGIN_TOKEN_INVALID");
  }
  return `https://t.me/${username}?start=auth_${token}`;
}

export function isTelegramLoginToken(token: string) {
  return TOKEN_PATTERN.test(token);
}

export function telegramLoginCookie(token: string) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${TELEGRAM_LOGIN_COOKIE}=${encodeURIComponent(token)}; Path=/api/auth/telegram-browser; HttpOnly; SameSite=Lax; Max-Age=${TELEGRAM_LOGIN_TTL_SECONDS}${secure}`;
}

export function clearTelegramLoginCookie() {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${TELEGRAM_LOGIN_COOKIE}=; Path=/api/auth/telegram-browser; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}

export async function createTelegramLoginRequest() {
  // Validate the public bot URL before touching the database so configuration
  // errors are reported as configuration errors, not database failures.
  const token = createTelegramLoginToken();
  const url = telegramLoginLink(token);
  const expiresAt = new Date(Date.now() + TELEGRAM_LOGIN_TTL_SECONDS * 1000);
  const db = getDb();

  await db.insert(telegramLoginRequests).values({ token, status: "pending", expiresAt });

  // Login challenges are short-lived. Opportunistic cleanup keeps the table small
  // without making successful authentication depend on a scheduled worker.
  if (Math.random() < 0.02) {
    await db
      .delete(telegramLoginRequests)
      .where(lt(telegramLoginRequests.expiresAt, new Date(Date.now() - 24 * 60 * 60 * 1000)));
  }

  return { token, url, expiresAt };
}

export type TelegramWebhookProfile = {
  id: number;
  firstName: string;
  lastName?: string;
  username?: string;
};

export async function confirmTelegramLoginRequest(token: string, profile: TelegramWebhookProfile) {
  if (!isTelegramLoginToken(token)) return false;

  const db = getDb();
  const now = new Date();
  const telegramId = BigInt(profile.id);
  const role = getAdminTelegramIds().has(telegramId) ? "admin" : "user";
  return db.transaction(async (tx) => {
    const [claimed] = await tx
      .update(telegramLoginRequests)
      .set({ telegramId, status: "confirmed", confirmedAt: now })
      .where(
        and(
          eq(telegramLoginRequests.token, token),
          eq(telegramLoginRequests.status, "pending"),
          gt(telegramLoginRequests.expiresAt, now),
        ),
      )
      .returning({ telegramId: telegramLoginRequests.telegramId });

    if (!claimed) {
      // Telegram retries a webhook when our response is lost. Treat a repeated
      // update from the same account as success so processing is idempotent.
      const [existing] = await tx
        .select({
          telegramId: telegramLoginRequests.telegramId,
          status: telegramLoginRequests.status,
          expiresAt: telegramLoginRequests.expiresAt,
        })
        .from(telegramLoginRequests)
        .where(eq(telegramLoginRequests.token, token))
        .limit(1);
      return (
        existing?.status === "confirmed" &&
        existing.expiresAt > now &&
        existing.telegramId === telegramId
      );
    }

    await tx
      .insert(users)
      .values({
        telegramId,
        username: profile.username,
        firstName: profile.firstName,
        lastName: profile.lastName,
        role,
      })
      .onConflictDoUpdate({
        target: users.telegramId,
        set: {
          username: profile.username,
          firstName: profile.firstName,
          lastName: profile.lastName,
          role,
          updatedAt: now,
        },
      });
    return true;
  });
}

export async function getTelegramLoginStatus(token: string) {
  if (!isTelegramLoginToken(token)) return { status: "expired" as const };

  const now = new Date();
  const [request] = await getDb()
    .select()
    .from(telegramLoginRequests)
    .where(eq(telegramLoginRequests.token, token))
    .limit(1);

  if (!request || request.expiresAt <= now) return { status: "expired" as const };
  if (request.status !== "confirmed" || !request.telegramId) {
    return {
      status: "pending" as const,
      expiresAt: request.expiresAt,
    };
  }

  const [user] = await getDb()
    .select()
    .from(users)
    .where(eq(users.telegramId, request.telegramId))
    .limit(1);
  if (!user) {
    throw new ApiError(500, "Пользователь Telegram не найден", "TELEGRAM_LOGIN_USER_NOT_FOUND");
  }

  return {
    status: "confirmed" as const,
    user: safeUser(user),
    sessionCookie: sessionCookie(createSessionToken(user.id)),
  };
}
