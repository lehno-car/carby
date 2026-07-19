import { eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { requireUser } from "@/server/auth/session";
import { validateVehicleSelection } from "@/server/catalog/service";
import { getDb } from "@/server/db";
import { carImages, carListings, users } from "@/server/db/schema";
import { ApiError, apiError, readJson } from "@/server/http";
import { assertOwnerOrAdmin, attachImages, getListingOrThrow } from "@/server/listings/service";
import { listingPatchSchema } from "@/server/listings/validation";
import { deleteImageObjects } from "@/server/storage";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  try {
    const { id } = await context.params;
    let listing = await getListingOrThrow(id);
    if (listing.status !== "active") {
      const user = await requireUser(request);
      assertOwnerOrAdmin(listing, user);
    } else {
      const [updated] = await getDb()
        .update(carListings)
        .set({ viewCount: sql`${carListings.viewCount} + 1` })
        .where(eq(carListings.id, id))
        .returning();
      if (updated) listing = updated;
    }
    const [owner] = await getDb()
      .select({ username: users.username, firstName: users.firstName, phone: users.phone })
      .from(users)
      .where(eq(users.id, listing.ownerId))
      .limit(1);
    const [result] = await attachImages([listing]);
    return NextResponse.json({ listing: { ...result, owner } });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: Request, context: Context) {
  try {
    const user = await requireUser(request);
    const { id } = await context.params;
    const current = await getListingOrThrow(id);
    assertOwnerOrAdmin(current, user);
    const input = listingPatchSchema.parse(await readJson(request));

    const update: Record<string, unknown> = { ...input, updatedAt: new Date() };
    for (const field of [
      "generationId",
      "color",
      "vin",
      "sellerPhone",
      "sellerTelegram",
    ] as const) {
      if (field in input) update[field] = input[field] || null;
    }
    const vehicleChanged = ["makeId", "modelId", "generationId", "manufactureYear"].some(
      (field) => field in input,
    );
    let yearWarning: string | null = null;
    if (vehicleChanged) {
      const makeId = input.makeId ?? current.makeId;
      const modelId = input.modelId ?? current.modelId;
      const generationId =
        "generationId" in input ? input.generationId || null : current.generationId;
      const manufactureYear = input.manufactureYear ?? current.manufactureYear ?? current.year;
      if (!makeId || !modelId) {
        throw new ApiError(
          400,
          "Выберите марку и модель из каталога",
          "CATALOG_SELECTION_REQUIRED",
        );
      }
      const catalog = await validateVehicleSelection({
        makeId,
        modelId,
        generationId,
        year: manufactureYear,
        allowInactive:
          makeId === current.makeId &&
          modelId === current.modelId &&
          generationId === current.generationId,
      });
      update.makeId = makeId;
      update.modelId = modelId;
      update.generationId = generationId;
      update.manufactureYear = manufactureYear;
      update.make = catalog.make.name;
      update.model = catalog.model.name;
      update.generation = catalog.generation?.name ?? null;
      update.year = manufactureYear;
      yearWarning = catalog.yearWarning;
    }
    if ("engineVolume" in input) {
      update.engineVolume =
        input.engineVolume === "" || input.engineVolume === undefined
          ? null
          : String(input.engineVolume);
    }
    if ("horsepower" in input)
      update.horsepower = input.horsepower === "" ? null : input.horsepower;
    if (!input.status && ["active", "rejected"].includes(current.status)) {
      update.status = "pending";
      update.rejectionReason = null;
    }
    const [listing] = await getDb()
      .update(carListings)
      .set(update)
      .where(eq(carListings.id, id))
      .returning();
    return NextResponse.json({ listing, warning: yearWarning });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: Request, context: Context) {
  try {
    const user = await requireUser(request);
    const { id } = await context.params;
    const listing = await getListingOrThrow(id);
    assertOwnerOrAdmin(listing, user);
    const images = await getDb()
      .select({ objectKey: carImages.objectKey, thumbnailKey: carImages.thumbnailKey })
      .from(carImages)
      .where(eq(carImages.listingId, id));
    await deleteImageObjects(images.flatMap((image) => [image.objectKey, image.thumbnailKey]));
    await getDb().delete(carListings).where(eq(carListings.id, id));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
