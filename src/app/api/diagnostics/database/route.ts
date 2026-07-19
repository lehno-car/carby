import { randomUUID } from "node:crypto";

import { eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getDb } from "@/server/db";
import { rateLimitEntries } from "@/server/db/schema";
import { enforceRateLimit } from "@/server/rate-limit";

export const dynamic = "force-dynamic";

const expectedTables = [
  "users",
  "car_listings",
  "car_images",
  "favorites",
  "reports",
  "moderation_events",
  "rate_limit_entries",
  "telegram_login_requests",
  "vehicle_makes",
  "vehicle_models",
  "vehicle_generations",
  "vehicle_catalog_imports",
  "catalog_change_requests",
] as const;

type DiagnosticStage =
  "connection" | "schema" | "rate_limit_read" | "rate_limit_insert" | "rate_limit_update";

function safeDatabaseError(error: unknown) {
  let candidate = error as { message?: unknown; code?: unknown; cause?: unknown };
  const visited = new Set<unknown>();
  while (
    candidate &&
    typeof candidate === "object" &&
    candidate.cause &&
    !visited.has(candidate.cause)
  ) {
    visited.add(candidate);
    candidate = candidate.cause as { message?: unknown; code?: unknown; cause?: unknown };
  }
  const message =
    typeof candidate?.message === "string"
      ? candidate.message.replace(/postgres(?:ql)?:\/\/\S+/gi, "[DATABASE_URL скрыт]").slice(0, 500)
      : "Неизвестная ошибка PostgreSQL";

  return {
    message,
    ...(typeof candidate?.code === "string" ? { postgresCode: candidate.code } : {}),
  };
}

function diagnosticFailure(stage: DiagnosticStage, error: unknown, started: number) {
  const requestId = randomUUID();
  const cause = safeDatabaseError(error);
  console.error("Database diagnostic failed", { requestId, stage, ...cause });

  return NextResponse.json(
    {
      status: "error",
      connection: stage === "connection" ? "error" : "ok",
      stage,
      error: cause.message,
      ...(cause.postgresCode ? { postgresCode: cause.postgresCode } : {}),
      requestId,
      latencyMs: Date.now() - started,
    },
    { status: 503 },
  );
}

export async function GET() {
  const started = Date.now();
  let stage: DiagnosticStage = "connection";

  try {
    const db = getDb();
    const [connection] = await db.execute<{ serverTime: Date }>(sql`select now() as "serverTime"`);

    stage = "schema";
    const rows = await db.execute<{ tableName: string }>(sql`
      select table_name as "tableName"
      from information_schema.tables
      where table_schema = 'public'
        and table_name in (${sql.join(
          expectedTables.map((table) => sql`${table}`),
          sql`, `,
        )})
    `);
    const existingTables = new Set(rows.map((row) => row.tableName));
    const tables = Object.fromEntries(
      expectedTables.map((table) => [table, existingTables.has(table)]),
    );
    const missingTables = expectedTables.filter((table) => !existingTables.has(table));

    stage = "rate_limit_read";
    const [rateLimit] = await db
      .select({ rows: sql<number>`count(*)::int` })
      .from(rateLimitEntries);

    return NextResponse.json(
      {
        status: missingTables.length ? "degraded" : "ok",
        connection: "ok",
        serverTime: connection?.serverTime ?? null,
        tables,
        missingTables,
        rateLimitRows: rateLimit?.rows ?? 0,
        latencyMs: Date.now() - started,
      },
      { status: missingTables.length ? 503 : 200 },
    );
  } catch (error) {
    return diagnosticFailure(stage, error, started);
  }
}

export async function POST() {
  const started = Date.now();
  const identity = `swagger-${randomUUID()}`;
  const key = `diagnostic:${identity}`;
  let stage: DiagnosticStage = "rate_limit_insert";

  try {
    await enforceRateLimit("diagnostic", identity, 10, 60);
    stage = "rate_limit_update";
    await enforceRateLimit("diagnostic", identity, 10, 60);

    return NextResponse.json({
      status: "ok",
      connection: "ok",
      insert: "ok",
      conflictUpdate: "ok",
      cleanup: "scheduled",
      latencyMs: Date.now() - started,
    });
  } catch (error) {
    return diagnosticFailure(stage, error, started);
  } finally {
    try {
      await getDb().delete(rateLimitEntries).where(eq(rateLimitEntries.key, key));
    } catch (cleanupError) {
      console.error("Database diagnostic cleanup failed", safeDatabaseError(cleanupError));
    }
  }
}
