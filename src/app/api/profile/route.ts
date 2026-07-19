import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { requireUser, safeUser } from "@/server/auth/session";
import { getDb } from "@/server/db";
import { users } from "@/server/db/schema";
import { ApiError, apiError, readJson } from "@/server/http";

const profileSchema = z.object({
  phone: z.union([
    z
      .string()
      .trim()
      .regex(/^\+?[0-9 ()-]{7,24}$/),
    z.literal(""),
    z.null(),
  ]),
});

export async function PATCH(request: Request) {
  try {
    const current = await requireUser(request);
    const { phone } = profileSchema.parse(await readJson(request));
    const [user] = await getDb()
      .update(users)
      .set({ phone: phone || null, updatedAt: new Date() })
      .where(eq(users.id, current.id))
      .returning();
    if (!user) throw new ApiError(404, "Пользователь не найден", "NOT_FOUND");
    return NextResponse.json({ user: safeUser(user) });
  } catch (error) {
    return apiError(error);
  }
}
