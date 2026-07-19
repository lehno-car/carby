import { NextResponse } from "next/server";
import { z } from "zod";

import { listCatalogGenerations } from "@/server/catalog/service";
import { apiError } from "@/server/http";

type Context = { params: Promise<{ modelId: string }> };

export async function GET(request: Request, context: Context) {
  try {
    const { modelId } = await context.params;
    z.uuid().parse(modelId);
    const params = new URL(request.url).searchParams;
    const yearValue = Number(params.get("year"));
    const result = await listCatalogGenerations(modelId, {
      query: params.get("query") ?? "",
      year: Number.isInteger(yearValue) && yearValue >= 1885 ? yearValue : undefined,
      page: Number(params.get("page") || 1),
      limit: Number(params.get("limit") || 50),
    });
    return NextResponse.json(result, {
      headers: { "cache-control": "public, max-age=60, stale-while-revalidate=300" },
    });
  } catch (error) {
    return apiError(error);
  }
}
