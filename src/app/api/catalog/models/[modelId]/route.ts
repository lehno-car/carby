import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getDb } from "@/server/db";
import { vehicleModels } from "@/server/db/schema";
import { ApiError, apiError } from "@/server/http";

type Context = { params: Promise<{ modelId: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const { modelId } = await context.params;
    z.uuid().parse(modelId);
    const [item] = await getDb()
      .select()
      .from(vehicleModels)
      .where(eq(vehicleModels.id, modelId))
      .limit(1);
    if (!item) throw new ApiError(404, "Модель не найдена", "CATALOG_MODEL_NOT_FOUND");
    return NextResponse.json({ item });
  } catch (error) {
    return apiError(error);
  }
}
