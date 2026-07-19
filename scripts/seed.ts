import "dotenv/config";
import { eq } from "drizzle-orm";

import { closeDb, getDb } from "../src/server/db";
import { carListings, users } from "../src/server/db/schema";

if (process.env.NODE_ENV === "production" && process.env.SEED_CONFIRM !== "YES_I_WANT_DEMO_DATA") {
  throw new Error("Production seed is disabled. Set SEED_CONFIRM=YES_I_WANT_DEMO_DATA explicitly.");
}

const db = getDb();
try {
  const [owner] = await db
    .insert(users)
    .values({ telegramId: 999000001n, username: "automarket_demo", firstName: "Демо-продавец" })
    .onConflictDoUpdate({ target: users.telegramId, set: { updatedAt: new Date() } })
    .returning();
  if (!owner) throw new Error("Could not create demo owner");

  const existing = await db
    .select({ id: carListings.id })
    .from(carListings)
    .where(eq(carListings.ownerId, owner.id))
    .limit(1);
  if (!existing.length) {
    await db.insert(carListings).values([
      {
        ownerId: owner.id,
        make: "Volkswagen",
        model: "Passat",
        generation: "B8 Highline",
        year: 2019,
        price: 67900,
        currency: "BYN",
        mileage: 148000,
        bodyType: "Универсал",
        fuelType: "Дизель",
        transmission: "Робот",
        drivetrain: "Передний",
        engineVolume: "2.0",
        horsepower: 150,
        color: "Серый",
        country: "Беларусь",
        city: "Минск",
        description:
          "Автомобиль в отличном состоянии, полностью обслужен. Два комплекта колёс, сервисная история.",
        sellerTelegram: "automarket_demo",
        status: "active",
      },
      {
        ownerId: owner.id,
        make: "Geely",
        model: "Coolray",
        generation: "Flagship",
        year: 2022,
        price: 73800,
        currency: "BYN",
        mileage: 42000,
        bodyType: "Кроссовер",
        fuelType: "Бензин",
        transmission: "Робот",
        drivetrain: "Передний",
        engineVolume: "1.5",
        horsepower: 177,
        color: "Красный",
        country: "Беларусь",
        city: "Гомель",
        description:
          "Один владелец. Обслуживание у официального дилера, кузов без окрасов, богатая комплектация.",
        sellerTelegram: "automarket_demo",
        status: "active",
      },
      {
        ownerId: owner.id,
        make: "BMW",
        model: "320d",
        generation: "F30",
        year: 2017,
        price: 21500,
        currency: "USD",
        mileage: 186000,
        bodyType: "Седан",
        fuelType: "Дизель",
        transmission: "Автомат",
        drivetrain: "Задний",
        engineVolume: "2.0",
        horsepower: 190,
        color: "Синий",
        country: "Беларусь",
        city: "Брест",
        description:
          "Ухоженный автомобиль без технических проблем. Свежая диагностика, аккуратный салон, два ключа.",
        sellerTelegram: "automarket_demo",
        status: "active",
      },
      {
        ownerId: owner.id,
        make: "Toyota",
        model: "RAV4",
        generation: "Style",
        year: 2020,
        price: 32900,
        currency: "USD",
        mileage: 91000,
        bodyType: "Кроссовер",
        fuelType: "Гибрид",
        transmission: "Вариатор",
        drivetrain: "Полный",
        engineVolume: "2.5",
        horsepower: 222,
        color: "Белый",
        country: "Беларусь",
        city: "Витебск",
        description:
          "Экономичный полный привод, прозрачная история обслуживания. Комплект зимней резины в подарок.",
        sellerTelegram: "automarket_demo",
        status: "active",
      },
      {
        ownerId: owner.id,
        make: "Lada",
        model: "Vesta",
        generation: "Comfort",
        year: 2021,
        price: 1650000,
        currency: "RUB",
        mileage: 58000,
        bodyType: "Седан",
        fuelType: "Бензин",
        transmission: "Механика",
        drivetrain: "Передний",
        engineVolume: "1.6",
        horsepower: 106,
        color: "Чёрный",
        country: "Беларусь",
        city: "Могилёв",
        description:
          "Практичный автомобиль на каждый день. Своевременное обслуживание, кондиционер, подогрев сидений.",
        sellerTelegram: "automarket_demo",
        status: "active",
      },
    ]);
  }
  console.log("Development seed completed");
} finally {
  await closeDb();
}
