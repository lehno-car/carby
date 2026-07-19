import { NextResponse } from "next/server";

import { listCatalogMakes } from "@/server/catalog/service";
import { apiError } from "@/server/http";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const featuredValue = params.get("featured");
    const result = await listCatalogMakes({
      query: params.get("query") ?? "",
      featured: featuredValue === "true" ? true : featuredValue === "false" ? false : undefined,
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
