import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { requireUser } from "@/server/auth/session";
import { getDb } from "@/server/db";
import { carImages, carListings } from "@/server/db/schema";
import { ApiError, apiError } from "@/server/http";
import { signedImageUrl } from "@/server/storage";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  try {
    const { id } = await context.params;
    const [result] = await getDb()
      .select({
        objectKey: carImages.objectKey,
        thumbnailKey: carImages.thumbnailKey,
        ownerId: carListings.ownerId,
        status: carListings.status,
      })
      .from(carImages)
      .innerJoin(carListings, eq(carImages.listingId, carListings.id))
      .where(eq(carImages.id, id))
      .limit(1);
    if (!result) throw new ApiError(404, "Фото не найдено", "NOT_FOUND");
    if (result.status !== "active") {
      const user = await requireUser(request);
      if (user.id !== result.ownerId && user.role !== "admin") {
        throw new ApiError(403, "Нет доступа к фото", "FORBIDDEN");
      }
    }
    const variant = new URL(request.url).searchParams.get("variant");
    const url = await signedImageUrl(variant === "full" ? result.objectKey : result.thumbnailKey);
    return NextResponse.redirect(url, {
      status: 307,
      headers: { "cache-control": "private, max-age=600" },
    });
  } catch (error) {
    return apiError(error);
  }
}
