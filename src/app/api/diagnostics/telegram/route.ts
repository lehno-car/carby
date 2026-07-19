import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { ApiError, apiError } from "@/server/http";
import { enforceRateLimit, requestIp } from "@/server/rate-limit";
import { getTelegramDiagnostics } from "@/server/telegram-bot";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = randomUUID();
  try {
    await enforceRateLimit("diagnostic:telegram", requestIp(request), 10, 60);
    const result = await getTelegramDiagnostics();
    return NextResponse.json(result, {
      status: result.status === "ok" ? 200 : 503,
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    if (error instanceof ApiError) return apiError(error, { requestId });
    console.error("Telegram diagnostic failed", {
      requestId,
      cause: error instanceof Error ? error.message : "Unknown error",
    });
    return apiError(
      new ApiError(
        503,
        "Не удалось получить состояние Telegram. Проверьте bot token и Railway logs",
        "TELEGRAM_DIAGNOSTIC_ERROR",
      ),
      { requestId },
    );
  }
}
