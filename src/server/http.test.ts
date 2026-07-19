import { describe, expect, it } from "vitest";
import { z } from "zod";

import { ApiError, apiError } from "./http";

describe("API error responses", () => {
  it("includes a safe error code and request ID", async () => {
    const response = apiError(new ApiError(503, "Проверьте конфигурацию", "CONFIG_ERROR"), {
      requestId: "request-123",
    });

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "Проверьте конфигурацию",
      code: "CONFIG_ERROR",
      requestId: "request-123",
    });
  });

  it("does not replace validation errors with a generic 500", async () => {
    const result = z.object({ initData: z.string().min(1) }).safeParse({ initData: "" });
    expect(result.success).toBe(false);
    if (result.success) return;

    const response = apiError(result.error, { requestId: "request-456" });
    const body = (await response.json()) as { code: string; requestId: string };

    expect(response.status).toBe(400);
    expect(body.code).toBe("VALIDATION_ERROR");
    expect(body.requestId).toBe("request-456");
  });
});
