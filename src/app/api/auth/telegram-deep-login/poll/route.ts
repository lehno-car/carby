import { NextResponse } from "next/server";
import { z } from "zod";

import { consumeTelegramLoginRequest } from "@/server/auth/telegram-deep-login";
import { apiError, readJson } from "@/server/http";
import { enforceRateLimit, requestIp } from "@/server/rate-limit";

const inputSchema = z.object({
  token: z.string().min(20).max(80),
});

export async function POST(request: Request) {
  try {
    await enforceRateLimit("auth:telegram-deep-login:poll", requestIp(request), 60, 60);
    const { token } = inputSchema.parse(await readJson(request));
    const result = await consumeTelegramLoginRequest(token);
    if (!result) return NextResponse.json({ status: "pending" });

    const response = NextResponse.json({ status: "confirmed", user: result.user });
    response.headers.set("set-cookie", result.cookie);
    return response;
  } catch (error) {
    return apiError(error);
  }
}
