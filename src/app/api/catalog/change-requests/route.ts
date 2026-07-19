import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdmin, requireUser } from "@/server/auth/session";
import { getDb } from "@/server/db";
import { catalogChangeRequests, users } from "@/server/db/schema";
import { apiError, readJson } from "@/server/http";
import { enforceRateLimit } from "@/server/rate-limit";

const createSchema = z.object({
  requestType: z.enum([
    "missing_make",
    "missing_model",
    "missing_generation",
    "incorrect_years",
    "duplicate",
    "other",
  ]),
  makeId: z.uuid().nullable().optional(),
  modelId: z.uuid().nullable().optional(),
  generationId: z.uuid().nullable().optional(),
  comment: z.string().trim().min(10).max(2000),
});

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    await enforceRateLimit("catalog-change-request", user.id, 10, 60 * 60);
    const input = createSchema.parse(await readJson(request));
    const [item] = await getDb()
      .insert(catalogChangeRequests)
      .values({ ...input, userId: user.id })
      .returning();
    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const items = await getDb()
      .select({
        request: catalogChangeRequests,
        user: { firstName: users.firstName, username: users.username },
      })
      .from(catalogChangeRequests)
      .innerJoin(users, eq(catalogChangeRequests.userId, users.id))
      .orderBy(desc(catalogChangeRequests.createdAt))
      .limit(200);
    return NextResponse.json({ items });
  } catch (error) {
    return apiError(error);
  }
}
