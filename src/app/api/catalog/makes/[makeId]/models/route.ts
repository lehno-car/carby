import { NextResponse } from "next/server";
import { z } from "zod";

import { listCatalogModels } from "@/server/catalog/service";
import { apiError } from "@/server/http";

type Context = { params: Promise<{ makeId: string }> };

export async function GET(request: Request, context: Context) {
  try {
    const { makeId } = await context.params;
    z.uuid().parse(makeId);
    const params = new URL(request.url).searchParams;
    const result = await listCatalogModels(makeId, {
      query: params.get("query") ?? "",
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
