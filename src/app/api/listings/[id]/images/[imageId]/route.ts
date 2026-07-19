import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { requireUser } from "@/server/auth/session";
import { getDb } from "@/server/db";
import { carImages } from "@/server/db/schema";
import { ApiError, apiError } from "@/server/http";
import { assertOwnerOrAdmin, getListingOrThrow } from "@/server/listings/service";
import { deleteImageObjects } from "@/server/storage";

type Context = { params: Promise<{ id: string; imageId: string }> };

export async function DELETE(request: Request, context: Context) {
  try {
    const user = await requireUser(request);
    const { id, imageId } = await context.params;
    const listing = await getListingOrThrow(id);
    assertOwnerOrAdmin(listing, user);
    const [image] = await getDb()
      .select()
      .from(carImages)
      .where(and(eq(carImages.id, imageId), eq(carImages.listingId, id)))
      .limit(1);
    if (!image) throw new ApiError(404, "Фото не найдено", "NOT_FOUND");
    await deleteImageObjects([image.objectKey, image.thumbnailKey]);
    await getDb().delete(carImages).where(eq(carImages.id, imageId));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
