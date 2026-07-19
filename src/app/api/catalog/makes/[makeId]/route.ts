import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getDb } from "@/server/db";
import { vehicleMakes } from "@/server/db/schema";
import { ApiError, apiError } from "@/server/http";

type Context = { params: Promise<{ makeId: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const { makeId } = await context.params;
    z.uuid().parse(makeId);
    const [item] = await getDb()
      .select()
      .from(vehicleMakes)
      .where(eq(vehicleMakes.id, makeId))
      .limit(1);
    if (!item) throw new ApiError(404, "Марка не найдена", "CATALOG_MAKE_NOT_FOUND");
    return NextResponse.json({ item });
  } catch (error) {
    return apiError(error);
  }
}
