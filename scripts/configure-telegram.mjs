function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

const token = required("TELEGRAM_BOT_TOKEN");
const appUrl = required("APP_URL").replace(/\/$/, "");
const webAppUrl = (process.env.TELEGRAM_WEBAPP_URL?.trim() || appUrl).replace(/\/$/, "");
const configuredUsername = required("TELEGRAM_BOT_USERNAME").replace(/^@/, "");
const webhookSecret = required("TELEGRAM_WEBHOOK_SECRET");

for (const [name, value] of [
  ["APP_URL", appUrl],
  ["TELEGRAM_WEBAPP_URL", webAppUrl],
]) {
  const url = new URL(value);
  if (url.protocol !== "https:") throw new Error(`${name} must use HTTPS`);
}
if (!/^\d+:[A-Za-z0-9_-]+$/.test(token)) {
  throw new Error("TELEGRAM_BOT_TOKEN has an invalid format");
}
if (!/^[A-Za-z0-9_]{5,32}$/.test(configuredUsername)) {
  throw new Error("TELEGRAM_BOT_USERNAME has an invalid format");
}
if (!/^[A-Za-z0-9_-]{16,256}$/.test(webhookSecret)) {
  throw new Error("TELEGRAM_WEBHOOK_SECRET must contain 16-256 characters: A-Z, a-z, 0-9, _ or -");
}

async function telegram(method, body = {}) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  const data = await response.json();
  if (!response.ok || !data.ok) {
    throw new Error(`${method}: ${data.description || `HTTP ${response.status}`}`);
  }
  return data.result;
}

console.log("Checking Telegram bot and webhook...");
const bot = await telegram("getMe");
if (bot.username.toLowerCase() !== configuredUsername.toLowerCase()) {
  throw new Error(
    `TELEGRAM_BOT_USERNAME is ${configuredUsername}, but the token belongs to @${bot.username}`,
  );
}

const webhookUrl = `${appUrl}/api/telegram/webhook`;
await telegram("setWebhook", {
  url: webhookUrl,
  secret_token: webhookSecret,
  allowed_updates: ["message"],
  drop_pending_updates: false,
});
await telegram("setMyCommands", {
  commands: [
    { command: "start", description: "Открыть Carby" },
    { command: "help", description: "Помощь" },
  ],
});
await telegram("setChatMenuButton", {
  menu_button: {
    type: "web_app",
    text: "Открыть Carby",
    web_app: { url: webAppUrl },
  },
});

const webhook = await telegram("getWebhookInfo");
if (webhook.url !== webhookUrl) {
  throw new Error(`Telegram webhook mismatch: expected ${webhookUrl}, received ${webhook.url}`);
}
console.log(`Telegram configured: @${bot.username}, webhook ${webhookUrl}`);
