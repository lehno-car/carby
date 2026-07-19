import { asc, count, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { requireUser } from "@/server/auth/session";
import { getDb } from "@/server/db";
import { carImages } from "@/server/db/schema";
import { ApiError, apiError, readJson } from "@/server/http";
import { assertOwnerOrAdmin, getListingOrThrow, imagePath } from "@/server/listings/service";
import { enforceRateLimit } from "@/server/rate-limit";
import { deleteImageObjects, processAndUploadImage } from "@/server/storage";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  const uploadedKeys: string[] = [];
  try {
    const user = await requireUser(request);
    await enforceRateLimit("upload", user.id, 30, 60 * 60);
    const { id } = await context.params;
    const listing = await getListingOrThrow(id);
    assertOwnerOrAdmin(listing, user);
    const countRows = await getDb()
      .select({ value: count() })
      .from(carImages)
      .where(eq(carImages.listingId, id));
    const existingCount = countRows[0]?.value ?? 0;
    const form = await request.formData();
    const files = form.getAll("images").filter((value): value is File => value instanceof File);
    if (!files.length) throw new ApiError(400, "Выберите хотя бы одно фото", "NO_IMAGES");
    if (existingCount + files.length > 10) {
      throw new ApiError(400, "В объявлении может быть не больше 10 фото", "TOO_MANY_IMAGES");
    }

    const rows: (typeof carImages.$inferInsert)[] = [];
    for (const [offset, file] of files.entries()) {
      const image = await processAndUploadImage(file, id);
      uploadedKeys.push(image.objectKey, image.thumbnailKey);
      rows.push({ ...image, listingId: id, position: existingCount + offset });
    }
    const inserted = await getDb().insert(carImages).values(rows).returning();
    return NextResponse.json(
      { images: inserted.map((image) => ({ id: image.id, url: imagePath(image.id) })) },
      { status: 201 },
    );
  } catch (error) {
    try {
      await deleteImageObjects(uploadedKeys);
    } catch {
      // Orphan cleanup can be retried operationally without exposing storage details to the client.
    }
    return apiError(error);
  }
}

export async function GET(request: Request, context: Context) {
  try {
    const user = await requireUser(request);
    const { id } = await context.params;
    const listing = await getListingOrThrow(id);
    assertOwnerOrAdmin(listing, user);
    const images = await getDb()
      .select({ id: carImages.id, position: carImages.position })
      .from(carImages)
      .where(eq(carImages.listingId, id))
      .orderBy(asc(carImages.position));
    return NextResponse.json({
      images: images.map((image) => ({ ...image, url: imagePath(image.id) })),
    });
  } catch (error) {
    return apiError(error);
  }
}

const reorderSchema = z.object({ imageIds: z.array(z.uuid()).max(10) });

export async function PATCH(request: Request, context: Context) {
  try {
    const user = await requireUser(request);
    const { id } = await context.params;
    const listing = await getListingOrThrow(id);
    assertOwnerOrAdmin(listing, user);
    const { imageIds } = reorderSchema.parse(await readJson(request));
    const existing = await getDb()
      .select({ id: carImages.id })
      .from(carImages)
      .where(eq(carImages.listingId, id));
    const existingIds = new Set(existing.map((image) => image.id));
    if (
      imageIds.length !== existingIds.size ||
      imageIds.some((imageId) => !existingIds.has(imageId))
    ) {
      throw new ApiError(400, "Передан неполный набор фотографий", "INVALID_IMAGE_ORDER");
    }
    await getDb().transaction(async (tx) => {
      for (const [position, imageId] of imageIds.entries()) {
        await tx.update(carImages).set({ position }).where(eq(carImages.id, imageId));
      }
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
