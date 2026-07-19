import { createHmac, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/server/db";
import { users } from "@/server/db/schema";
import { ApiError } from "@/server/http";

export const SESSION_COOKIE = "automarket_session";
const sessionSchema = z.object({
  userId: z.uuid(),
  exp: z.number().int(),
});

function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32)
    throw new Error("SESSION_SECRET must contain at least 32 characters");
  return value;
}

export function createSessionToken(userId: string, ttlSeconds = 60 * 60 * 24 * 30) {
  const payload = Buffer.from(
    JSON.stringify({ userId, exp: Math.floor(Date.now() / 1000) + ttlSeconds }),
  ).toString("base64url");
  const signature = createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifySessionToken(token: string) {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) throw new ApiError(401, "Требуется авторизация", "UNAUTHORIZED");
  const expected = createHmac("sha256", secret()).update(payload).digest();
  const received = Buffer.from(signature, "base64url");
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    throw new ApiError(401, "Сессия недействительна", "INVALID_SESSION");
  }
  const parsed = sessionSchema.safeParse(JSON.parse(Buffer.from(payload, "base64url").toString()));
  if (!parsed.success || parsed.data.exp < Math.floor(Date.now() / 1000)) {
    throw new ApiError(401, "Сессия истекла", "EXPIRED_SESSION");
  }
  return parsed.data;
}

function readCookie(request: Request, name: string) {
  const cookie = request.headers.get("cookie") ?? "";
  for (const part of cookie.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return undefined;
}

export async function requireUser(request: Request) {
  const token = readCookie(request, SESSION_COOKIE);
  if (!token) throw new ApiError(401, "Откройте приложение через Telegram", "UNAUTHORIZED");
  const session = verifySessionToken(token);
  const [user] = await getDb().select().from(users).where(eq(users.id, session.userId)).limit(1);
  if (!user) throw new ApiError(401, "Пользователь не найден", "UNAUTHORIZED");
  return user;
}

export async function requireAdmin(request: Request) {
  const user = await requireUser(request);
  assertAdmin(user);
  return user;
}

export function assertAdmin(user: Pick<typeof users.$inferSelect, "role">) {
  if (user.role !== "admin") throw new ApiError(403, "Недостаточно прав", "FORBIDDEN");
}

export function sessionCookie(token: string) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=2592000${secure}`;
}

export function clearSessionCookie() {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`;
}

export function safeUser(user: typeof users.$inferSelect) {
  return {
    id: user.id,
    telegramId: user.telegramId.toString(),
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    photoUrl: user.photoUrl,
    phone: user.phone,
    role: user.role,
  };
}
