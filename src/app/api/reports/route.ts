import { NextResponse } from "next/server";
import { z } from "zod";

import { requireUser } from "@/server/auth/session";
import { getDb } from "@/server/db";
import { reports } from "@/server/db/schema";
import { apiError, readJson } from "@/server/http";
import { getListingOrThrow } from "@/server/listings/service";
import { reportInputSchema } from "@/server/listings/validation";
import { enforceRateLimit } from "@/server/rate-limit";

const inputSchema = reportInputSchema.extend({ listingId: z.uuid() });

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    await enforceRateLimit("report", user.id, 10, 60 * 60);
    const input = inputSchema.parse(await readJson(request));
    await getListingOrThrow(input.listingId);
    const [report] = await getDb()
      .insert(reports)
      .values({ ...input, reporterId: user.id })
      .returning();
    return NextResponse.json({ report }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
