"use client";

import { Car, Heart } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { api, formatMileage, formatPrice } from "@/lib/api";
import type { Listing } from "@/lib/types";

export function ListingCard({
  listing,
  initiallyFavorite = false,
}: {
  listing: Listing;
  initiallyFavorite?: boolean;
}) {
  const [favorite, setFavorite] = useState(initiallyFavorite);
  const [busy, setBusy] = useState(false);

  async function toggleFavorite() {
    if (busy) return;
    setBusy(true);
    try {
      await api(`/api/favorites/${listing.id}`, { method: favorite ? "DELETE" : "POST" });
      setFavorite(!favorite);
      window.Telegram?.WebApp.HapticFeedback?.impactOccurred("light");
    } catch (error) {
      alert(error instanceof Error ? error.message : "Не удалось изменить избранное");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="car-card">
      <div className="car-photo">
        <Link href={`/listing/${listing.id}`} aria-label={`${listing.make} ${listing.model}`}>
          {listing.images[0] ? (
            <img
              src={listing.images[0].url}
              alt={`${listing.make} ${listing.model}`}
              loading="lazy"
            />
          ) : (
            <span className="placeholder">
              <Car size={38} />
            </span>
          )}
        </Link>
        <button
          className={`favorite${favorite ? " on" : ""}`}
          onClick={toggleFavorite}
          disabled={busy}
          aria-label={favorite ? "Удалить из избранного" : "Добавить в избранное"}
        >
          <Heart size={19} fill={favorite ? "currentColor" : "none"} />
        </button>
      </div>
      <Link href={`/listing/${listing.id}`} className="car-content">
        <p className="car-title">
          {listing.make} {listing.model}
        </p>
        <p className="car-price">{formatPrice(listing.price, listing.currency)}</p>
        <p className="car-meta">
          {listing.year} · {formatMileage(listing.mileage)}
          <br />
          {listing.city}
        </p>
      </Link>
    </article>
  );
}
