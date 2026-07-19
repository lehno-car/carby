import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdmin } from "@/server/auth/session";
import { getDb } from "@/server/db";
import { catalogChangeRequests } from "@/server/db/schema";
import { apiError, readJson } from "@/server/http";

type Context = { params: Promise<{ id: string }> };
const patchSchema = z.object({
  status: z.enum(["open", "in_review", "resolved", "rejected"]),
  adminResponse: z.string().trim().max(2000).nullable().optional(),
});

export async function PATCH(request: Request, context: Context) {
  try {
    await requireAdmin(request);
    const { id } = await context.params;
    z.uuid().parse(id);
    const input = patchSchema.parse(await readJson(request));
    const [item] = await getDb()
      .update(catalogChangeRequests)
      .set({
        ...input,
        processedAt: input.status === "open" ? null : new Date(),
      })
      .where(eq(catalogChangeRequests.id, id))
      .returning();
    return NextResponse.json({ item });
  } catch (error) {
    return apiError(error);
  }
}
