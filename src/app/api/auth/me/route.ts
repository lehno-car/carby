import { NextResponse } from "next/server";

import { requireUser, safeUser } from "@/server/auth/session";
import { apiError } from "@/server/http";

export async function GET(request: Request) {
  try {
    return NextResponse.json({ user: safeUser(await requireUser(request)) });
  } catch (error) {
    return apiError(error);
  }
}
