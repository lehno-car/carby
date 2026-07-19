import { describe, expect, it } from "vitest";

import { parseTelegramStartPayload } from "./route";

describe("Telegram webhook /start parsing", () => {
  it("reads an authentication payload", () => {
    expect(parseTelegramStartPayload("/start auth_abc_DEF-123")).toBe("auth_abc_DEF-123");
  });

  it("supports commands addressed to the bot", () => {
    expect(parseTelegramStartPayload("/start@carbytestbot auth_token")).toBe("auth_token");
  });

  it("ignores unrelated messages", () => {
    expect(parseTelegramStartPayload("hello")).toBeNull();
  });
});
