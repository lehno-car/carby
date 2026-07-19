import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { requireUser } from "@/server/auth/session";
import { getDb } from "@/server/db";
import { carListings, favorites } from "@/server/db/schema";
import { ApiError, apiError } from "@/server/http";

type Context = { params: Promise<{ listingId: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const user = await requireUser(request);
    const { listingId } = await context.params;
    const [listing] = await getDb()
      .select({ id: carListings.id })
      .from(carListings)
      .where(and(eq(carListings.id, listingId), eq(carListings.status, "active")))
      .limit(1);
    if (!listing) throw new ApiError(404, "Объявление не найдено", "NOT_FOUND");
    await getDb().insert(favorites).values({ userId: user.id, listingId }).onConflictDoNothing();
    return NextResponse.json({ favorite: true });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: Request, context: Context) {
  try {
    const user = await requireUser(request);
    const { listingId } = await context.params;
    await getDb()
      .delete(favorites)
      .where(and(eq(favorites.userId, user.id), eq(favorites.listingId, listingId)));
    return NextResponse.json({ favorite: false });
  } catch (error) {
    return apiError(error);
  }
}
