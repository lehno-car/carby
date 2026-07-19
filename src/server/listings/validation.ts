import { z } from "zod";

const currentYear = new Date().getFullYear();
const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));

export const currencyValues = ["BYN", "RUB", "USD"] as const;
export const bodyTypes = [
  "Седан",
  "Универсал",
  "Хэтчбек",
  "Кроссовер",
  "Внедорожник",
  "Купе",
  "Минивэн",
  "Пикап",
  "Кабриолет",
] as const;
export const fuelTypes = ["Бензин", "Дизель", "Гибрид", "Электро", "Газ"] as const;
export const transmissions = ["Механика", "Автомат", "Робот", "Вариатор"] as const;
export const drivetrains = ["Передний", "Задний", "Полный"] as const;

export const listingInputSchema = z.object({
  make: z.string().trim().min(1).max(80),
  model: z.string().trim().min(1).max(80),
  generation: optionalText(120),
  year: z.coerce
    .number()
    .int()
    .min(1900)
    .max(currentYear + 1),
  price: z.coerce.number().int().min(50).max(10_000_000_000),
  currency: z.enum(currencyValues).default("BYN"),
  mileage: z.coerce.number().int().min(0).max(5_000_000),
  bodyType: z.enum(bodyTypes),
  fuelType: z.enum(fuelTypes),
  transmission: z.enum(transmissions),
  drivetrain: z.enum(drivetrains),
  engineVolume: z.union([z.coerce.number().min(0.1).max(9.9), z.literal("")]).optional(),
  horsepower: z.union([z.coerce.number().int().min(1).max(3000), z.literal("")]).optional(),
  color: optionalText(64),
  vin: z
    .union([
      z
        .string()
        .trim()
        .toUpperCase()
        .regex(/^[A-HJ-NPR-Z0-9]{17}$/),
      z.literal(""),
    ])
    .optional(),
  country: z.literal("Беларусь").default("Беларусь"),
  city: z.string().trim().min(2).max(80),
  description: z.string().trim().min(20).max(5000),
  sellerPhone: z
    .union([
      z
        .string()
        .trim()
        .regex(/^\+?[0-9 ()-]{7,24}$/),
      z.literal(""),
    ])
    .optional(),
  sellerTelegram: z
    .union([
      z
        .string()
        .trim()
        .regex(/^@?[A-Za-z0-9_]{5,32}$/),
      z.literal(""),
    ])
    .optional(),
});

export const listingPatchSchema = listingInputSchema.partial().extend({
  status: z.enum(["draft", "pending", "sold", "archived"]).optional(),
});

export const reportInputSchema = z.object({
  reason: z.enum(["Мошенничество", "Продано", "Неверные данные", "Дубликат", "Другое"]),
  details: z.string().trim().max(1000).optional(),
});

export const moderationInputSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve") }),
  z.object({ action: z.literal("reject"), reason: z.string().trim().min(5).max(1000) }),
]);

export function normalizeListingInput(data: z.infer<typeof listingInputSchema>) {
  return {
    ...data,
    generation: data.generation || null,
    engineVolume:
      data.engineVolume === "" || data.engineVolume === undefined
        ? null
        : String(data.engineVolume),
    horsepower: data.horsepower === "" || data.horsepower === undefined ? null : data.horsepower,
    color: data.color || null,
    vin: data.vin || null,
    sellerPhone: data.sellerPhone || null,
    sellerTelegram: data.sellerTelegram?.replace(/^@/, "") || null,
  };
}

export function maskVin(vin: string | null) {
  return vin ? `${vin.slice(0, 3)}••••••••••${vin.slice(-4)}` : null;
}
