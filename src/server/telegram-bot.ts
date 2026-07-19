type TelegramResponse<T> = { ok: boolean; result?: T; description?: string };

async function telegramRequest<T>(method: string, body: unknown) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not configured");
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  const data = (await response.json()) as TelegramResponse<T>;
  if (!response.ok || !data.ok)
    throw new Error(`Telegram ${method} failed: ${data.description ?? response.status}`);
  return data.result;
}

export function sendStartMessage(chatId: number) {
  const webAppUrl = process.env.TELEGRAM_WEBAPP_URL ?? process.env.APP_URL;
  return telegramRequest("sendMessage", {
    chat_id: chatId,
    text: "🚗 Добро пожаловать в AutoMarket — автомобили с пробегом по Беларуси.",
    reply_markup: {
      inline_keyboard: [[{ text: "Открыть AutoMarket", web_app: { url: webAppUrl } }]],
    },
  });
}

export async function notifyModerationResult(
  telegramId: bigint,
  listingTitle: string,
  approved: boolean,
  reason?: string,
) {
  const text = approved
    ? `✅ Объявление «${listingTitle}» опубликовано.`
    : `❌ Объявление «${listingTitle}» отклонено. Причина: ${reason}`;
  try {
    await telegramRequest("sendMessage", { chat_id: telegramId.toString(), text });
  } catch (error) {
    console.error(
      "Telegram notification failed",
      error instanceof Error ? error.message : "Unknown error",
    );
  }
}
