import { NextResponse } from "next/server";
import { z } from "zod";

import { createSessionToken, safeUser, sessionCookie } from "@/server/auth/session";
import { validateTelegramInitData } from "@/server/auth/telegram";
import { getDb } from "@/server/db";
import { users } from "@/server/db/schema";
import { getAdminTelegramIds } from "@/server/env";
import { apiError, readJson } from "@/server/http";
import { enforceRateLimit, requestIp } from "@/server/rate-limit";

const inputSchema = z.object({ initData: z.string().min(1).max(20_000) });

export async function POST(request: Request) {
  try {
    await enforceRateLimit("auth", requestIp(request), 20, 60);
    const { initData } = inputSchema.parse(await readJson(request));
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) throw new Error("TELEGRAM_BOT_TOKEN is not configured");
    const profile = validateTelegramInitData(initData, botToken);
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
    return apiError(error);
  }
}
