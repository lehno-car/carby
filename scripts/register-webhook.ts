import "dotenv/config";

const token = process.env.TELEGRAM_BOT_TOKEN;
const appUrl = process.env.APP_URL;
const webAppUrl = process.env.TELEGRAM_WEBAPP_URL ?? appUrl;
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
if (!token || !appUrl || !webAppUrl || !secret) {
  throw new Error(
    "Set TELEGRAM_BOT_TOKEN, APP_URL, TELEGRAM_WEBAPP_URL and TELEGRAM_WEBHOOK_SECRET",
  );
}
if (!appUrl.startsWith("https://")) throw new Error("Telegram webhook requires an HTTPS APP_URL");

async function call(method: string, body: unknown) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await response.json()) as { ok: boolean; description?: string };
  if (!response.ok || !data.ok)
    throw new Error(`${method}: ${data.description ?? response.statusText}`);
}

await call("setWebhook", {
  url: `${appUrl.replace(/\/$/, "")}/api/telegram/webhook`,
  secret_token: secret,
  allowed_updates: ["message"],
  drop_pending_updates: false,
});
await call("setChatMenuButton", {
  menu_button: { type: "web_app", text: "AutoMarket", web_app: { url: webAppUrl } },
});
console.log("Telegram webhook and menu button configured");
