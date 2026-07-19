import { NextResponse } from "next/server";

import { createTelegramLoginRequest } from "@/server/auth/telegram-deep-login";
import { ApiError, apiError } from "@/server/http";
import { enforceRateLimit, requestIp } from "@/server/rate-limit";

function safeErrorMessage(error: unknown) {
  let candidate = error as { message?: unknown; code?: unknown; cause?: unknown };
  const visited = new Set<unknown>();
  while (
    candidate &&
    typeof candidate === "object" &&
    candidate.cause &&
    !visited.has(candidate.cause)
  ) {
    visited.add(candidate);
    candidate = candidate.cause as { message?: unknown; code?: unknown; cause?: unknown };
  }

  return typeof candidate?.message === "string"
    ? candidate.message.replace(/postgres(?:ql)?:\/\/\S+/gi, "[DATABASE_URL скрыт]").slice(0, 500)
    : "Неизвестная ошибка";
}

export async function POST(request: Request) {
  try {
    try {
      await enforceRateLimit("auth:telegram-deep-login:start", requestIp(request), 10, 60);
    } catch (error) {
      console.error("Telegram deep login rate limit failed", { cause: safeErrorMessage(error) });
      throw new ApiError(
        503,
        "Не удалось проверить лимит запросов. Проверьте таблицу rate_limit_entries и миграции Railway",
        "AUTH_RATE_LIMIT_DATABASE_ERROR",
      );
    }

    let login: Awaited<ReturnType<typeof createTelegramLoginRequest>>;
    try {
      login = await createTelegramLoginRequest();
    } catch (error) {
      console.error("Telegram deep login request creation failed", { cause: safeErrorMessage(error) });
      throw new ApiError(
        503,
        "Не удалось создать ссылку входа. Проверьте таблицу telegram_login_requests и миграции Railway",
        "TELEGRAM_DEEP_LOGIN_DATABASE_ERROR",
      );
    }

    return NextResponse.json({
      token: login.token,
      url: login.url,
      expiresAt: login.expiresAt.toISOString(),
    });
  } catch (error) {
    return apiError(error);
  }
}
