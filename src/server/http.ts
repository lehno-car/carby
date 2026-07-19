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

type ApiErrorOptions = {
  requestId?: string;
};

function errorBody(error: string, code: string, requestId?: string, extra?: object) {
  return {
    error,
    code,
    ...(requestId ? { requestId } : {}),
    ...extra,
  };
}

export function apiError(error: unknown, options: ApiErrorOptions = {}) {
  if (error instanceof ApiError) {
    return NextResponse.json(errorBody(error.message, error.code, options.requestId), {
      status: error.status,
    });
  }
  if (error instanceof ZodError) {
    return NextResponse.json(
      errorBody("Проверьте заполненные поля", "VALIDATION_ERROR", options.requestId, {
        issues: error.issues,
      }),
      { status: 400 },
    );
  }
  console.error("Request failed", error instanceof Error ? error.message : "Unknown error");
  return NextResponse.json(
    errorBody("Внутренняя ошибка сервера", "INTERNAL_ERROR", options.requestId),
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
