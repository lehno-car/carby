import { NextResponse } from "next/server";

import { requireUser } from "@/server/auth/session";
import { getDb } from "@/server/db";
import { carListings } from "@/server/db/schema";
import { apiError, readJson } from "@/server/http";
import { listActiveListings } from "@/server/listings/service";
import { listingInputSchema, normalizeListingInput } from "@/server/listings/validation";
import { enforceRateLimit } from "@/server/rate-limit";

export async function GET(request: Request) {
  try {
    return NextResponse.json(await listActiveListings(new URL(request.url).searchParams));
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    await enforceRateLimit("create-listing", user.id, 10, 60 * 60);
    const input = normalizeListingInput(listingInputSchema.parse(await readJson(request)));
    const [listing] = await getDb()
      .insert(carListings)
      .values({ ...input, ownerId: user.id, status: "pending" })
      .returning();
    return NextResponse.json({ listing }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
