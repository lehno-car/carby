import { NextResponse } from "next/server";

import { searchCatalog } from "@/server/catalog/service";
import { apiError } from "@/server/http";

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    return NextResponse.json(
      await searchCatalog(params.get("query") ?? "", Number(params.get("limit") || 20)),
      { headers: { "cache-control": "public, max-age=30, stale-while-revalidate=120" } },
    );
  } catch (error) {
    return apiError(error);
  }
}
