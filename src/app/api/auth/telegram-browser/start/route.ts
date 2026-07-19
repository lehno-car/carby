import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import {
  createTelegramLoginRequest,
  telegramLoginCookie,
} from "@/server/auth/telegram-browser-login";
import { ApiError, apiError } from "@/server/http";
import { enforceRateLimit, requestIp } from "@/server/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = randomUUID();
  let stage: "rate_limit" | "login_request" = "rate_limit";
  try {
    await enforceRateLimit("auth:telegram-browser:start", requestIp(request), 10, 60);
    stage = "login_request";
    const login = await createTelegramLoginRequest();
    const response = NextResponse.redirect(login.url, 302);
    response.headers.append("set-cookie", telegramLoginCookie(login.token));
    response.headers.set("cache-control", "no-store");
    return response;
  } catch (error) {
    if (error instanceof ApiError) return apiError(error, { requestId });
    console.error("Telegram browser login start failed", {
      requestId,
      stage,
      cause: error instanceof Error ? error.message : "Unknown error",
    });
    const diagnosticError =
      stage === "rate_limit"
        ? new ApiError(
            503,
            "Не удалось проверить лимит запросов. Проверьте PostgreSQL и миграции Railway",
            "AUTH_RATE_LIMIT_DATABASE_ERROR",
          )
        : new ApiError(
            503,
            "Не удалось создать запрос входа. Проверьте DATABASE_URL и таблицу telegram_login_requests",
            "TELEGRAM_LOGIN_DATABASE_ERROR",
          );
    return apiError(diagnosticError, { requestId });
  }
}
