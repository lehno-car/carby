import { NextResponse } from "next/server";

import { ApiError, apiError } from "@/server/http";

export async function GET() {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
    if (!botToken) {
      throw new ApiError(503, "На сервере не настроен TELEGRAM_BOT_TOKEN", "TELEGRAM_BOT_TOKEN_MISSING");
    }
    const botId = botToken.split(":")[0];
    if (!botId || !/^\d+$/.test(botId)) {
      throw new ApiError(
        503,
        "TELEGRAM_BOT_TOKEN имеет неверный формат. Получите новый токен у @BotFather",
        "TELEGRAM_BOT_TOKEN_INVALID_FORMAT",
      );
    }

    return NextResponse.json({
      botId,
      botUsername: process.env.TELEGRAM_BOT_USERNAME?.trim() ?? null,
    });
  } catch (error) {
    return apiError(error);
  }
}
