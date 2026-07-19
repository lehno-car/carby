import { NextResponse } from "next/server";

import { catalogVersion } from "@/server/catalog/service";
import { apiError } from "@/server/http";

export async function GET() {
  try {
    return NextResponse.json(
      { catalog: await catalogVersion() },
      { headers: { "cache-control": "public, max-age=60, stale-while-revalidate=300" } },
    );
  } catch (error) {
    return apiError(error);
  }
}
