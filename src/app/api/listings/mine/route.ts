import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { requireUser } from "@/server/auth/session";
import { getDb } from "@/server/db";
import { carListings } from "@/server/db/schema";
import { apiError } from "@/server/http";
import { attachImages } from "@/server/listings/service";

export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    const listings = await getDb()
      .select()
      .from(carListings)
      .where(eq(carListings.ownerId, user.id))
      .orderBy(desc(carListings.createdAt));
    return NextResponse.json({ items: await attachImages(listings) });
  } catch (error) {
    return apiError(error);
  }
}
