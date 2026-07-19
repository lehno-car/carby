import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { requireUser } from "@/server/auth/session";
import { getDb } from "@/server/db";
import { carListings, favorites } from "@/server/db/schema";
import { apiError } from "@/server/http";
import { attachImages } from "@/server/listings/service";

export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    const rows = await getDb()
      .select({ listing: carListings })
      .from(favorites)
      .innerJoin(carListings, eq(favorites.listingId, carListings.id))
      .where(eq(favorites.userId, user.id))
      .orderBy(desc(favorites.createdAt));
    return NextResponse.json({ items: await attachImages(rows.map((row) => row.listing)) });
  } catch (error) {
    return apiError(error);
  }
}
