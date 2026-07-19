import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";

import { validateTelegramInitData } from "./telegram";

const botToken = "123456:test-token";

function signedInitData(authDate: number, extra: Record<string, string> = {}) {
  const params = new URLSearchParams({
    auth_date: String(authDate),
    query_id: "test-query",
    user: JSON.stringify({ id: 12345, first_name: "Иван", username: "ivan_test" }),
    ...extra,
  });
  const checkString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const secret = createHmac("sha256", "WebAppData").update(botToken).digest();
  params.set("hash", createHmac("sha256", secret).update(checkString).digest("hex"));
  return params.toString();
}

describe("Telegram initData validation", () => {
  it("accepts correctly signed fresh data", () => {
    const user = validateTelegramInitData(signedInitData(1_000_000), botToken, 3600, 1_000_100);
    expect(user).toMatchObject({ id: 12345, first_name: "Иван" });
  });

  it("accepts hash validation when Telegram also sends a signature field", () => {
    const user = validateTelegramInitData(
      signedInitData(1_000_000, { signature: "telegram-signature" }),
      botToken,
      3600,
      1_000_100,
    );

    expect(user).toMatchObject({ id: 12345, username: "ivan_test" });
  });

  it("rejects a changed signature", () => {
    expect(() =>
      validateTelegramInitData(
        signedInitData(1_000_000).replace("ivan_test", "attacker"),
        botToken,
        3600,
        1_000_100,
      ),
    ).toThrow("Подпись");
  });

  it("rejects expired data", () => {
    expect(() =>
      validateTelegramInitData(signedInitData(1_000_000), botToken, 3600, 1_004_000),
    ).toThrow("истекла");
  });
});
