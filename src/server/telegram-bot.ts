type TelegramResponse<T> = { ok: boolean; result?: T; description?: string };

type TelegramBotInfo = {
  id: number;
  is_bot: true;
  first_name: string;
  username: string;
};

type TelegramWebhookInfo = {
  url: string;
  pending_update_count: number;
  last_error_date?: number;
  last_error_message?: string;
  allowed_updates?: string[];
};

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
  if (!response.ok || !data.ok) {
    throw new Error(`Telegram ${method} failed: ${data.description ?? response.status}`);
  }
  return data.result;
}

export function sendStartMessage(chatId: number) {
  const webAppUrl = process.env.TELEGRAM_WEBAPP_URL ?? process.env.APP_URL;
  return telegramRequest("sendMessage", {
    chat_id: chatId,
    text: "Добро пожаловать в AutoMarket. Здесь можно открыть Mini App или подтвердить вход с сайта.",
    reply_markup: {
      inline_keyboard: [[{ text: "Открыть AutoMarket", web_app: { url: webAppUrl } }]],
    },
  });
}

export function sendLoginConfirmedMessage(chatId: number, confirmed: boolean) {
  return telegramRequest("sendMessage", {
    chat_id: chatId,
    text: confirmed
      ? "Вход подтверждён. Вернитесь на сайт, авторизация завершится автоматически."
      : "Ссылка авторизации не найдена или истекла. Вернитесь на сайт и нажмите «Войти через Telegram» ещё раз.",
  });
}

export async function getTelegramDiagnostics() {
  const appUrl = process.env.APP_URL?.trim().replace(/\/$/, "");
  const configuredUsername = process.env.TELEGRAM_BOT_USERNAME?.trim().replace(/^@/, "");
  if (!appUrl) throw new Error("APP_URL is not configured");
  if (!configuredUsername) throw new Error("TELEGRAM_BOT_USERNAME is not configured");

  const [bot, webhook] = await Promise.all([
    telegramRequest<TelegramBotInfo>("getMe", {}),
    telegramRequest<TelegramWebhookInfo>("getWebhookInfo", {}),
  ]);
  if (!bot || !webhook) throw new Error("Telegram returned an empty diagnostics response");

  const expectedWebhookUrl = `${appUrl}/api/telegram/webhook`;
  const usernameMatches = bot.username.toLowerCase() === configuredUsername.toLowerCase();
  const webhookMatches = webhook.url === expectedWebhookUrl;

  return {
    status: usernameMatches && webhookMatches ? ("ok" as const) : ("error" as const),
    bot: {
      id: bot.id,
      username: bot.username,
      configuredUsername,
      usernameMatches,
    },
    webhook: {
      url: webhook.url,
      expectedUrl: expectedWebhookUrl,
      matches: webhookMatches,
      pendingUpdates: webhook.pending_update_count,
      allowedUpdates: webhook.allowed_updates ?? [],
      lastErrorAt: webhook.last_error_date
        ? new Date(webhook.last_error_date * 1000).toISOString()
        : null,
      lastError: webhook.last_error_message ?? null,
    },
  };
}

export async function notifyModerationResult(
  telegramId: bigint,
  listingTitle: string,
  approved: boolean,
  reason?: string,
) {
  const text = approved
    ? `Объявление «${listingTitle}» опубликовано.`
    : `Объявление «${listingTitle}» отклонено. Причина: ${reason}`;
  try {
    await telegramRequest("sendMessage", { chat_id: telegramId.toString(), text });
  } catch (error) {
    console.error(
      "Telegram notification failed",
      error instanceof Error ? error.message : "Unknown error",
    );
  }
}
