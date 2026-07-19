import { NextResponse } from "next/server";
import { ZodError } from "zod";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code = "API_ERROR",
  ) {
    super(message);
  }
}

export function apiError(error: unknown) {
  if (error instanceof ApiError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  }
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: "Проверьте заполненные поля", code: "VALIDATION_ERROR", issues: error.issues },
      { status: 400 },
    );
  }
  console.error("Request failed", error instanceof Error ? error.message : "Unknown error");
  return NextResponse.json(
    { error: "Внутренняя ошибка сервера", code: "INTERNAL_ERROR" },
    { status: 500 },
  );
}

export async function readJson(request: Request): Promise<unknown> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new ApiError(415, "Ожидается JSON", "UNSUPPORTED_MEDIA_TYPE");
  }
  try {
    return await request.json();
  } catch {
    throw new ApiError(400, "Некорректный JSON", "INVALID_JSON");
  }
}
