"use client";

import {
  CalendarDays,
  Car,
  Eye,
  Flag,
  Gauge,
  Heart,
  MapPin,
  MessageCircle,
  Phone,
  Share2,
} from "lucide-react";
import { useEffect, useState } from "react";

import { BackButton } from "@/components/back-button";
import { api, formatMileage, formatPrice } from "@/lib/api";
import type { Listing } from "@/lib/types";

export function ListingDetail({ id }: { id: string }) {
  const [listing, setListing] = useState<Listing | null>(null);
  const [activeImage, setActiveImage] = useState(0);
  const [favorite, setFavorite] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ listing: Listing }>(`/api/listings/${id}`)
      .then((result) => setListing(result.listing))
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Ошибка загрузки"));
  }, [id]);

  async function toggleFavorite() {
    try {
      await api(`/api/favorites/${id}`, { method: favorite ? "DELETE" : "POST" });
      setFavorite(!favorite);
    } catch (reason) {
      alert(reason instanceof Error ? reason.message : "Не удалось изменить избранное");
    }
  }

  async function report() {
    const details = prompt("Опишите проблему с объявлением");
    if (!details) return;
    try {
      await api("/api/reports", {
        method: "POST",
        body: JSON.stringify({ listingId: id, reason: "Другое", details }),
      });
      alert("Спасибо. Жалоба отправлена модератору.");
    } catch (reason) {
      alert(reason instanceof Error ? reason.message : "Не удалось отправить жалобу");
    }
  }

  if (error)
    return (
      <>
        <div className="page-header">
          <BackButton />
        </div>
        <div className="empty">
          <div>
            <Car size={42} />
            <h3>Объявление недоступно</h3>
            <p className="error">{error}</p>
          </div>
        </div>
      </>
    );

  if (!listing)
    return (
      <>
        <div className="page-header">
          <BackButton />
        </div>
        <div className="skeleton" />
      </>
    );

  const image = listing.images[activeImage];
  const telegram = listing.sellerTelegram || listing.owner?.username;
  const phone = listing.sellerPhone || listing.owner?.phone;

  return (
    <article className="listing-page">
      <section
        className="listing-hero"
        onClick={() =>
          listing.images.length && setActiveImage((activeImage + 1) % listing.images.length)
        }
      >
        {image ? (
          <img
            src={image.url.replace("variant=thumb", "variant=full")}
            alt={`${listing.make} ${listing.model}`}
          />
        ) : (
          <span className="placeholder">
            <Car size={56} />
          </span>
        )}
        <div className="listing-hero-shade" />
        <div className="listing-hero-actions">
          <BackButton />
          <button
            className={`icon-button${favorite ? " favorite on" : ""}`}
            onClick={toggleFavorite}
            aria-label="Избранное"
          >
            <Heart size={21} fill={favorite ? "currentColor" : "none"} />
          </button>
        </div>
        <button className="icon-button listing-share" type="button" aria-label="Поделиться">
          <Share2 size={19} />
        </button>
        {listing.images.length > 0 && (
          <span className="gallery-count">
            {activeImage + 1} / {listing.images.length}
          </span>
        )}
      </section>

      <section className="listing-sheet">
        <span className="sheet-handle" />
        <div className="title-row">
          <div>
            <h1>
              {listing.make} {listing.model}
            </h1>
            {listing.generation && <p className="muted">{listing.generation}</p>}
          </div>
          <span className="verified-badge">Проверенный</span>
        </div>
        <p className="price-large">{formatPrice(listing.price, listing.currency)}</p>

        <div className="details-list section">
          <Detail
            icon={<CalendarDays size={21} />}
            label="Год выпуска"
            value={String(listing.year)}
          />
          <Detail
            icon={<Gauge size={21} />}
            label="Пробег"
            value={formatMileage(listing.mileage)}
          />
          <Detail icon={<Car size={21} />} label="Топливо" value={listing.fuelType} />
          <Detail icon={<Car size={21} />} label="Коробка" value={listing.transmission} />
        </div>

        <section className="panel section">
          <h2>Описание</h2>
          <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{listing.description}</p>
          <p className="muted small">
            <MapPin size={14} style={{ verticalAlign: -2 }} /> {listing.country}, {listing.city}
          </p>
        </section>

        <section className="seller-row section">
          <div className="seller-avatar">{listing.owner?.firstName?.[0] ?? "A"}</div>
          <div>
            <h3>{listing.owner?.firstName ?? "Владелец автомобиля"}</h3>
            <p className="muted small">
              <Eye size={14} style={{ verticalAlign: -2 }} /> {listing.viewCount} просмотров
            </p>
          </div>
          <button className="icon-button" onClick={() => void report()} aria-label="Пожаловаться">
            <Flag size={17} />
          </button>
        </section>
      </section>

      <div className="contact-bar">
        {phone ? (
          <a className="button secondary" href={`tel:${phone}`}>
            <Phone size={18} /> Позвонить
          </a>
        ) : (
          <button className="button secondary" disabled>
            <Phone size={18} /> Нет телефона
          </button>
        )}
        {telegram ? (
          <a
            className="button"
            href={`https://t.me/${telegram.replace(/^@/, "")}`}
            target="_blank"
            rel="noreferrer"
          >
            <MessageCircle size={18} /> Написать
          </a>
        ) : (
          <button className="button" disabled>
            Нет Telegram
          </button>
        )}
      </div>
    </article>
  );
}

function Detail({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="detail">
      {icon}
      <div>
        <strong>{value}</strong>
        <span>{label}</span>
      </div>
    </div>
  );
}
