export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: {
      ...(options?.body instanceof FormData ? {} : { "content-type": "application/json" }),
      ...options?.headers,
    },
  });
  const data = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(data.error ?? `Ошибка ${response.status}`);
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
