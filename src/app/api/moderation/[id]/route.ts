import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { requireAdmin } from "@/server/auth/session";
import { getDb } from "@/server/db";
import { carListings, moderationEvents, users } from "@/server/db/schema";
import { ApiError, apiError, readJson } from "@/server/http";
import { getListingOrThrow } from "@/server/listings/service";
import { moderationInputSchema } from "@/server/listings/validation";
import { notifyModerationResult } from "@/server/telegram-bot";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const admin = await requireAdmin(request);
    const { id } = await context.params;
    const input = moderationInputSchema.parse(await readJson(request));
    const listing = await getListingOrThrow(id);
    if (listing.status !== "pending") {
      throw new ApiError(409, "Объявление уже обработано", "INVALID_LISTING_STATUS");
    }
    const approved = input.action === "approve";
    const reason = approved ? null : input.reason;

    const result = await getDb().transaction(async (tx) => {
      const [updated] = await tx
        .update(carListings)
        .set({
          status: approved ? "active" : "rejected",
          rejectionReason: reason,
          updatedAt: new Date(),
        })
        .where(eq(carListings.id, id))
        .returning();
      await tx.insert(moderationEvents).values({
        listingId: id,
        adminId: admin.id,
        action: approved ? "approved" : "rejected",
        reason,
      });
      return updated;
    });

    const [owner] = await getDb()
      .select({ telegramId: users.telegramId })
      .from(users)
      .where(eq(users.id, listing.ownerId))
      .limit(1);
    if (owner) {
      void notifyModerationResult(
        owner.telegramId,
        `${listing.make} ${listing.model}`,
        approved,
        reason ?? undefined,
      );
    }
    return NextResponse.json({ listing: result });
  } catch (error) {
    return apiError(error);
  }
}
