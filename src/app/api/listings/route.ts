import { NextResponse } from "next/server";

import { requireUser } from "@/server/auth/session";
import { validateVehicleSelection } from "@/server/catalog/service";
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
    const catalog = await validateVehicleSelection({
      makeId: input.makeId,
      modelId: input.modelId,
      generationId: input.generationId,
      year: input.manufactureYear,
    });
    const [listing] = await getDb()
      .insert(carListings)
      .values({
        ...input,
        make: catalog.make.name,
        model: catalog.model.name,
        generation: catalog.generation?.name ?? null,
        year: input.manufactureYear,
        ownerId: user.id,
        status: "pending",
      })
      .returning();
    return NextResponse.json({ listing, warning: catalog.yearWarning }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
