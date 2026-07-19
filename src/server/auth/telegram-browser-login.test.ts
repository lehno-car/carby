import { describe, expect, it } from "vitest";

import {
  createTelegramLoginToken,
  isTelegramLoginToken,
  telegramLoginLink,
} from "./telegram-browser-login";

describe("Telegram browser login", () => {
  it("creates an official deep link with a valid, one-time base64url token", () => {
    const token = createTelegramLoginToken();
    const url = new URL(telegramLoginLink(token, "carbytestbot"));

    expect(isTelegramLoginToken(token)).toBe(true);
    expect(url.origin).toBe("https://t.me");
    expect(url.pathname).toBe("/carbytestbot");
    expect(url.searchParams.get("start")).toBe(`auth_${token}`);
    expect(url.searchParams.get("start")?.length).toBeLessThanOrEqual(64);
  });

  it("rejects malformed login tokens", () => {
    expect(isTelegramLoginToken("short-token")).toBe(false);
    expect(() => telegramLoginLink("short-token", "carbytestbot")).toThrow(
      "Некорректный токен входа",
    );
  });
});
