import { NextResponse } from "next/server";

import { createSessionToken, safeUser, sessionCookie } from "@/server/auth/session";
import { getDb } from "@/server/db";
import { users } from "@/server/db/schema";
import { ApiError, apiError } from "@/server/http";
import { enforceRateLimit, requestIp } from "@/server/rate-limit";

export async function POST(request: Request) {
  try {
    if (process.env.NODE_ENV === "production" || process.env.DEV_AUTH_ENABLED !== "true") {
      throw new ApiError(404, "Маршрут не найден", "NOT_FOUND");
    }
    await enforceRateLimit("dev-auth", requestIp(request), 10, 60);
    const [user] = await getDb()
      .insert(users)
      .values({ telegramId: 1n, username: "dev_user", firstName: "Тестовый пользователь" })
      .onConflictDoUpdate({ target: users.telegramId, set: { updatedAt: new Date() } })
      .returning();
    if (!user) throw new Error("Development user upsert failed");
    const response = NextResponse.json({ user: safeUser(user), development: true });
    response.headers.set("set-cookie", sessionCookie(createSessionToken(user.id)));
    return response;
  } catch (error) {
    return apiError(error);
  }
}
