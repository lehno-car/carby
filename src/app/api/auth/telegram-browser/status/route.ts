import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import {
  clearTelegramLoginCookie,
  getTelegramLoginStatus,
  TELEGRAM_LOGIN_COOKIE,
} from "@/server/auth/telegram-browser-login";
import { ApiError, apiError } from "@/server/http";
import { enforceRateLimit, requestIp } from "@/server/rate-limit";

export const dynamic = "force-dynamic";

function readCookie(request: Request, name: string) {
  const cookie = request.headers.get("cookie") ?? "";
  for (const part of cookie.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return undefined;
}

export async function GET(request: Request) {
  const requestId = randomUUID();
  try {
    await enforceRateLimit("auth:telegram-browser:status", requestIp(request), 90, 60);
    const token = readCookie(request, TELEGRAM_LOGIN_COOKIE);
    if (!token) {
      return NextResponse.json({ status: "idle" }, { headers: { "cache-control": "no-store" } });
    }

    const result = await getTelegramLoginStatus(token);
    if (result.status === "pending") {
      return NextResponse.json(
        { status: "pending", expiresAt: result.expiresAt.toISOString() },
        { headers: { "cache-control": "no-store" } },
      );
    }
    if (result.status === "expired") {
      const response = NextResponse.json(
        { status: "expired" },
        { headers: { "cache-control": "no-store" } },
      );
      response.headers.append("set-cookie", clearTelegramLoginCookie());
      return response;
    }

    const response = NextResponse.json(
      { status: "confirmed", user: result.user },
      { headers: { "cache-control": "no-store" } },
    );
    response.headers.append("set-cookie", result.sessionCookie);
    response.headers.append("set-cookie", clearTelegramLoginCookie());
    return response;
  } catch (error) {
    if (error instanceof ApiError) return apiError(error, { requestId });
    console.error("Telegram browser login status failed", {
      requestId,
      cause: error instanceof Error ? error.message : "Unknown error",
    });
    return apiError(
      new ApiError(
        503,
        "Не удалось проверить подтверждение входа. Проверьте PostgreSQL и миграции Railway",
        "TELEGRAM_LOGIN_STATUS_DATABASE_ERROR",
      ),
      { requestId },
    );
  }
}
