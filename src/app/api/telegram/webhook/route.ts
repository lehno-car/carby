import { NextResponse } from "next/server";
import { z } from "zod";

import { ApiError, apiError } from "@/server/http";
import { sendStartMessage } from "@/server/telegram-bot";

const updateSchema = z.object({
  update_id: z.number().int(),
  message: z
    .object({
      text: z.string().optional(),
      chat: z.object({ id: z.number().int() }),
    })
    .optional(),
});

export async function POST(request: Request) {
  try {
    const configuredSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (!configuredSecret) throw new Error("TELEGRAM_WEBHOOK_SECRET is not configured");
    if (request.headers.get("x-telegram-bot-api-secret-token") !== configuredSecret) {
      throw new ApiError(401, "Некорректный секрет webhook", "INVALID_WEBHOOK_SECRET");
    }
    const update = updateSchema.parse(await request.json());
    if (update.message?.text?.startsWith("/start")) {
      await sendStartMessage(update.message.chat.id);
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
