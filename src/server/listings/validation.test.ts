import { describe, expect, it } from "vitest";

import { listingInputSchema, maskVin } from "./validation";

const valid = {
  makeId: "11111111-1111-4111-8111-111111111111",
  modelId: "22222222-2222-4222-8222-222222222222",
  manufactureYear: 2019,
  price: 67000,
  currency: "BYN",
  mileage: 120000,
  bodyType: "Универсал",
  fuelType: "Дизель",
  transmission: "Робот",
  drivetrain: "Передний",
  country: "Беларусь",
  city: "Минск",
  description: "Полностью обслуженный автомобиль с прозрачной историей.",
};

describe("listing validation", () => {
  it("accepts Belarus and all supported currencies", () => {
    for (const currency of ["BYN", "RUB", "USD"]) {
      expect(listingInputSchema.parse({ ...valid, currency }).currency).toBe(currency);
    }
  });

  it("rejects unsupported country and currency", () => {
    expect(listingInputSchema.safeParse({ ...valid, currency: "EUR" }).success).toBe(false);
    expect(listingInputSchema.safeParse({ ...valid, country: "Польша" }).success).toBe(false);
  });

  it("never exposes a complete VIN", () => {
    const masked = maskVin("WVWZZZ3CZWE123456");
    expect(masked).toBe("WVW••••••••••3456");
    expect(masked).not.toContain("ZZZ3CZWE12");
  });
});
