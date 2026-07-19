import { lte, sql } from "drizzle-orm";

import { getDb } from "@/server/db";
import { rateLimitEntries } from "@/server/db/schema";
import { ApiError } from "@/server/http";

export async function enforceRateLimit(
  namespace: string,
  identity: string,
  limit: number,
  windowSeconds: number,
) {
  const db = getDb();
  const key = `${namespace}:${identity}`.slice(0, 180);
  const now = new Date();
  const resetAt = new Date(now.getTime() + windowSeconds * 1000);

  const [entry] = await db
    .insert(rateLimitEntries)
    .values({ key, count: 1, resetAt })
    .onConflictDoUpdate({
      target: rateLimitEntries.key,
      set: {
        count: sql`case when ${rateLimitEntries.resetAt} <= now() then 1 else ${rateLimitEntries.count} + 1 end`,
        resetAt: sql`case when ${rateLimitEntries.resetAt} <= now() then ${resetAt} else ${rateLimitEntries.resetAt} end`,
      },
    })
    .returning({ count: rateLimitEntries.count, resetAt: rateLimitEntries.resetAt });

  if (entry && entry.count > limit && entry.resetAt > now) {
    throw new ApiError(429, "Слишком много запросов. Попробуйте позже", "RATE_LIMITED");
  }

  if (Math.random() < 0.01) {
    await db.delete(rateLimitEntries).where(lte(rateLimitEntries.resetAt, now));
  }
}

export function requestIp(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}
