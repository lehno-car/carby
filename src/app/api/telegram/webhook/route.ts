import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import {
  confirmTelegramLoginRequest,
  isTelegramLoginToken,
} from "@/server/auth/telegram-browser-login";
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
          id: z.number().int().positive(),
          first_name: z.string().min(1),
          last_name: z.string().optional(),
          username: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
});

function secretsMatch(received: string | null, expected: string) {
  if (!received) return false;
  const receivedBytes = Buffer.from(received);
  const expectedBytes = Buffer.from(expected);
  return (
    receivedBytes.length === expectedBytes.length && timingSafeEqual(receivedBytes, expectedBytes)
  );
}

export function parseTelegramStartPayload(text: string | undefined) {
  if (!text) return null;
  const match = text.match(/^\/start(?:@[A-Za-z0-9_]+)?(?:\s+([A-Za-z0-9_-]+))?\s*$/);
  return match ? (match[1] ?? "") : null;
}

export async function POST(request: Request) {
  try {
    const configuredSecret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
    if (!configuredSecret) {
      throw new ApiError(
        503,
        "На сервере не настроен TELEGRAM_WEBHOOK_SECRET",
        "TELEGRAM_WEBHOOK_SECRET_MISSING",
      );
    }
    if (!secretsMatch(request.headers.get("x-telegram-bot-api-secret-token"), configuredSecret)) {
      throw new ApiError(401, "Некорректный секрет webhook", "INVALID_WEBHOOK_SECRET");
    }

    const update = updateSchema.parse(await request.json());
    const message = update.message;
    const payload = parseTelegramStartPayload(message?.text);
    if (payload === null || !message) return NextResponse.json({ ok: true });

    if (payload.startsWith("auth_") && message.from) {
      const token = payload.slice("auth_".length);
      const confirmed =
        isTelegramLoginToken(token) &&
        (await confirmTelegramLoginRequest(token, {
          id: message.from.id,
          firstName: message.from.first_name,
          lastName: message.from.last_name,
          username: message.from.username,
        }));
      await sendLoginConfirmedMessage(message.chat.id, confirmed);
    } else {
      await sendStartMessage(message.chat.id);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
