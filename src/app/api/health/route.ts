import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getDb } from "@/server/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const started = Date.now();
  try {
    await getDb().execute(sql`select 1`);
    return NextResponse.json({ status: "ok", database: "ok", latencyMs: Date.now() - started });
  } catch (error) {
    console.error("Health check failed", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json(
      { status: "error", database: "unavailable", latencyMs: Date.now() - started },
      { status: 503 },
    );
  }
}
