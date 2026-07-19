import { NextResponse } from "next/server";
import { z } from "zod";

import { confirmTelegramLoginRequest } from "@/server/auth/telegram-deep-login";
import { ApiError, apiError } from "@/server/http";
import { sendLoginConfirmedMessage, sendStartMessage } from "@/server/telegram-bot";

const updateSchema = z.object({
  update_id: z.number().int(),
  message: z
    .object({
      text: z.string().optional(),
      chat: z.object({ id: z.number().int() }),
      from: z
        .object({
          id: z.number().int(),
          first_name: z.string(),
          last_name: z.string().optional(),
          username: z.string().optional(),
        })
        .optional(),
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
    const message = update.message;
    if (message?.text?.startsWith("/start")) {
      const payload = message.text.split(/\s+/, 2)[1];
      if (payload?.startsWith("login_") && message.from) {
        const token = payload.slice("login_".length);
        const confirmed = await confirmTelegramLoginRequest(token, {
          id: message.from.id,
          firstName: message.from.first_name,
          lastName: message.from.last_name,
          username: message.from.username,
        });
        await sendLoginConfirmedMessage(message.chat.id, confirmed);
      } else {
        await sendStartMessage(message.chat.id);
      }
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
