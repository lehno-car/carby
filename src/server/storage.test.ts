import { describe, expect, it } from "vitest";

import { MAX_IMAGE_SIZE, validateImageSize } from "./storage";

describe("image upload limits", () => {
  it("accepts non-empty files up to 10 MB", () => {
    expect(() => validateImageSize(1)).not.toThrow();
    expect(() => validateImageSize(MAX_IMAGE_SIZE)).not.toThrow();
  });
  it("rejects empty and oversized files", () => {
    expect(() => validateImageSize(0)).toThrow("10 МБ");
    expect(() => validateImageSize(MAX_IMAGE_SIZE + 1)).toThrow("10 МБ");
  });
});
