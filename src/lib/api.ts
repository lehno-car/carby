type ApiErrorResponse = {
  error?: string;
  code?: string;
  requestId?: string;
};

export class ApiClientError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public requestId?: string,
  ) {
    const details = [code ? `код: ${code}` : null, requestId ? `ID: ${requestId}` : null].filter(
      Boolean,
    );
    super(details.length ? `${message} (${details.join(", ")})` : message);
    this.name = "ApiClientError";
  }
}

export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: {
      ...(options?.body instanceof FormData ? {} : { "content-type": "application/json" }),
      ...options?.headers,
    },
  });
  const data = (await response.json().catch(() => ({}))) as T & ApiErrorResponse;
  if (!response.ok) {
    throw new ApiClientError(
      data.error ?? `Ошибка ${response.status}`,
      response.status,
      data.code,
      data.requestId,
    );
  }
  return data;
}

export function formatPrice(price: number, currency: string) {
  return (
    new Intl.NumberFormat("ru-BY", { maximumFractionDigits: 0 }).format(price) + ` ${currency}`
  );
}

export function formatMileage(mileage: number) {
  return new Intl.NumberFormat("ru-BY").format(mileage) + " км";
}
