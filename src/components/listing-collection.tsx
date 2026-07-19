"use client";

import { Car, Heart } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { ListingCard } from "@/components/listing-card";
import { PageHeader } from "@/components/page-header";
import { api } from "@/lib/api";
import type { Listing } from "@/lib/types";

export function ListingCollection({ mode }: { mode: "favorites" | "mine" }) {
  const [items, setItems] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<{ items: Listing[] }>(
        mode === "favorites" ? "/api/favorites" : "/api/listings/mine",
      );
      setItems(data.items);
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, [mode]);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function markSold(id: string) {
    try {
      await api(`/api/listings/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "sold" }),
      });
      await load();
    } catch (reason) {
      alert(reason instanceof Error ? reason.message : "Не удалось обновить статус");
    }
  }
  async function remove(id: string) {
    if (!confirm("Удалить объявление без возможности восстановления?")) return;
    try {
      await api(`/api/listings/${id}`, { method: "DELETE" });
      await load();
    } catch (reason) {
      alert(reason instanceof Error ? reason.message : "Не удалось удалить объявление");
    }
  }

  return (
    <>
      <PageHeader title={mode === "favorites" ? "Избранное" : "Мои авто"} subtitle="AutoMarket" />
      {loading && <div className="skeleton" />}
      {error && <div className="notice">{error}</div>}
      {!loading && !error && !items.length && (
        <div className="empty">
          <div>
            {mode === "favorites" ? <Heart size={42} /> : <Car size={42} />}
            <h3>{mode === "favorites" ? "Здесь пока пусто" : "У вас нет объявлений"}</h3>
            <p className="muted">
              {mode === "favorites"
                ? "Нажимайте на сердечко, чтобы сохранить автомобиль."
                : "Добавьте автомобиль — заполнение займёт несколько минут."}
            </p>
          </div>
        </div>
      )}
      {mode === "favorites" ? (
        <div className="car-grid">
          {items.map((listing) => (
            <ListingCard key={listing.id} listing={listing} initiallyFavorite />
          ))}
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {items.map((listing) => (
            <div className="panel" key={listing.id}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <div>
                  <h3>
                    {listing.make} {listing.model}
                  </h3>
                  <p className="muted small">
                    {listing.year} · {listing.city}
                  </p>
                </div>
                <span className={`status ${listing.status}`}>{statusLabel(listing.status)}</span>
              </div>
              {listing.rejectionReason && (
                <p className="notice">Причина: {listing.rejectionReason}</p>
              )}
              <div className="form-actions">
                <a className="button secondary" href={`/listing/${listing.id}`}>
                  Открыть
                </a>
                <a className="button secondary" href={`/sell?edit=${listing.id}`}>
                  Изменить
                </a>
                {listing.status === "active" && (
                  <button className="button" onClick={() => void markSold(listing.id)}>
                    Продано
                  </button>
                )}
                <button className="button secondary" onClick={() => void remove(listing.id)}>
                  Удалить
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function statusLabel(status: Listing["status"]) {
  return {
    draft: "Черновик",
    pending: "На проверке",
    active: "Активно",
    rejected: "Отклонено",
    sold: "Продано",
    archived: "В архиве",
  }[status];
}
