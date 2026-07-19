import { randomBytes } from "node:crypto";

import { and, eq, gt } from "drizzle-orm";

import { createSessionToken, safeUser, sessionCookie } from "@/server/auth/session";
import { getDb } from "@/server/db";
import { telegramLoginRequests, users } from "@/server/db/schema";
import { getAdminTelegramIds } from "@/server/env";
import { ApiError } from "@/server/http";

const LOGIN_TTL_MS = 5 * 60 * 1000;

export function createLoginToken() {
  return randomBytes(24).toString("base64url");
}

export function telegramDeepLoginUrl(token: string) {
  const username = process.env.TELEGRAM_BOT_USERNAME?.trim();
  if (!username) throw new ApiError(503, "На сервере не настроен TELEGRAM_BOT_USERNAME", "TELEGRAM_BOT_USERNAME_MISSING");
  return `https://t.me/${username.replace(/^@/, "")}?start=login_${token}`;
}

export async function createTelegramLoginRequest() {
  const token = createLoginToken();
  const expiresAt = new Date(Date.now() + LOGIN_TTL_MS);

  await getDb().insert(telegramLoginRequests).values({
    token,
    status: "pending",
    expiresAt,
  });

  return {
    token,
    expiresAt,
    url: telegramDeepLoginUrl(token),
  };
}

export async function confirmTelegramLoginRequest(
  token: string,
  profile: {
    id: number;
    firstName: string;
    lastName?: string;
    username?: string;
    photoUrl?: string;
  },
) {
  const now = new Date();
  const [request] = await getDb()
    .select()
    .from(telegramLoginRequests)
    .where(and(eq(telegramLoginRequests.token, token), eq(telegramLoginRequests.status, "pending"), gt(telegramLoginRequests.expiresAt, now)))
    .limit(1);

  if (!request) return false;

  const telegramId = BigInt(profile.id);
  const role = getAdminTelegramIds().has(telegramId) ? "admin" : "user";

  await getDb()
    .insert(users)
    .values({
      telegramId,
      username: profile.username,
      firstName: profile.firstName,
      lastName: profile.lastName,
      photoUrl: profile.photoUrl,
      role,
    })
    .onConflictDoUpdate({
      target: users.telegramId,
      set: {
        username: profile.username,
        firstName: profile.firstName,
        lastName: profile.lastName,
        photoUrl: profile.photoUrl,
        role,
        updatedAt: now,
      },
    });

  await getDb()
    .update(telegramLoginRequests)
    .set({ telegramId, status: "confirmed", confirmedAt: now })
    .where(eq(telegramLoginRequests.token, token));

  return true;
}

export async function consumeTelegramLoginRequest(token: string) {
  const now = new Date();
  const [request] = await getDb()
    .select()
    .from(telegramLoginRequests)
    .where(eq(telegramLoginRequests.token, token))
    .limit(1);

  if (!request || request.expiresAt <= now) {
    throw new ApiError(410, "Ссылка авторизации истекла. Попробуйте войти ещё раз.", "TELEGRAM_LOGIN_EXPIRED");
  }
  if (request.status !== "confirmed" || !request.telegramId) {
    return null;
  }

  const [user] = await getDb().select().from(users).where(eq(users.telegramId, request.telegramId)).limit(1);
  if (!user) throw new ApiError(404, "Пользователь Telegram не найден", "TELEGRAM_LOGIN_USER_NOT_FOUND");

  await getDb()
    .update(telegramLoginRequests)
    .set({ status: "consumed" })
    .where(eq(telegramLoginRequests.token, token));

  return {
    user: safeUser(user),
    cookie: sessionCookie(createSessionToken(user.id)),
  };
}
