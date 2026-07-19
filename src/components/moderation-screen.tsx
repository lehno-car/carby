"use client";

import { Check, ShieldCheck, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { BackButton } from "@/components/back-button";
import { api, formatPrice } from "@/lib/api";
import type { Listing } from "@/lib/types";

export function ModerationScreen({ embedded = false }: { embedded?: boolean }) {
  const [items, setItems] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<{ items: Listing[] }>("/api/moderation");
      setItems(data.items);
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function decide(id: string, action: "approve" | "reject") {
    const reason =
      action === "reject" ? prompt("Укажите причину отклонения (не менее 5 символов)") : undefined;
    if (action === "reject" && !reason) return;
    try {
      await api(`/api/moderation/${id}`, {
        method: "POST",
        body: JSON.stringify({ action, reason }),
      });
      setItems((current) => current.filter((item) => item.id !== id));
    } catch (decisionError) {
      alert(
        decisionError instanceof Error ? decisionError.message : "Не удалось выполнить действие",
      );
    }
  }

  return (
    <>
      {!embedded && (
        <header className="page-header">
          <BackButton />
          <div style={{ flex: 1 }}>
            <p className="eyebrow">Администратор</p>
            <h1>Модерация</h1>
          </div>
          <ShieldCheck color="var(--accent)" />
        </header>
      )}
      {loading && <div className="skeleton" />}
      {error && <p className="notice">{error}</p>}
      {!loading && !items.length && !error && (
        <div className="empty">
          <div>
            <Check size={44} />
            <h3>Очередь пуста</h3>
            <p className="muted">Все новые объявления проверены.</p>
          </div>
        </div>
      )}
      <div style={{ display: "grid", gap: 14 }}>
        {items.map((listing) => (
          <article className="panel" key={listing.id}>
            {listing.images[0] && (
              <img
                src={listing.images[0].url}
                alt=""
                style={{
                  width: "100%",
                  aspectRatio: "1.8",
                  objectFit: "cover",
                  borderRadius: 14,
                  marginBottom: 12,
                }}
              />
            )}
            <p className="eyebrow">
              {listing.city} · {listing.year}
            </p>
            <h2>
              {listing.make} {listing.model}
            </h2>
            <p className="car-price">{formatPrice(listing.price, listing.currency)}</p>
            <p style={{ lineHeight: 1.5 }}>{listing.description}</p>
            <a className="button secondary full" href={`/listing/${listing.id}`}>
              Посмотреть полностью
            </a>
            <div className="form-actions">
              <button className="button danger" onClick={() => void decide(listing.id, "reject")}>
                <X size={18} /> Отклонить
              </button>
              <button
                className="button"
                style={{ background: "var(--success)" }}
                onClick={() => void decide(listing.id, "approve")}
              >
                <Check size={18} /> Одобрить
              </button>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
