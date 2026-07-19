import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getDb } from "@/server/db";
import { vehicleGenerations } from "@/server/db/schema";
import { ApiError, apiError } from "@/server/http";

type Context = { params: Promise<{ generationId: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const { generationId } = await context.params;
    z.uuid().parse(generationId);
    const [item] = await getDb()
      .select()
      .from(vehicleGenerations)
      .where(eq(vehicleGenerations.id, generationId))
      .limit(1);
    if (!item) throw new ApiError(404, "Поколение не найдено", "CATALOG_GENERATION_NOT_FOUND");
    return NextResponse.json({ item });
  } catch (error) {
    return apiError(error);
  }
}
