import { asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { requireAdmin } from "@/server/auth/session";
import { getDb } from "@/server/db";
import { carListings } from "@/server/db/schema";
import { apiError } from "@/server/http";
import { attachImages } from "@/server/listings/service";

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const listings = await getDb()
      .select()
      .from(carListings)
      .where(eq(carListings.status, "pending"))
      .orderBy(asc(carListings.createdAt))
      .limit(100);
    return NextResponse.json({ items: await attachImages(listings) });
  } catch (error) {
    return apiError(error);
  }
}
