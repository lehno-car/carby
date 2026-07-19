import { NextResponse } from "next/server";

import { createTelegramLoginRequest } from "@/server/auth/telegram-deep-login";
import { apiError } from "@/server/http";
import { enforceRateLimit, requestIp } from "@/server/rate-limit";

export async function POST(request: Request) {
  try {
    await enforceRateLimit("auth:telegram-deep-login:start", requestIp(request), 10, 60);
    const login = await createTelegramLoginRequest();
    return NextResponse.json({
      token: login.token,
      url: login.url,
      expiresAt: login.expiresAt.toISOString(),
    });
  } catch (error) {
    return apiError(error);
  }
}
