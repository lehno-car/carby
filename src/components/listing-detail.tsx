"use client";

import { Car, Eye, Flag, Heart, MapPin, MessageCircle, Phone } from "lucide-react";
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
    <>
      <div className="page-header">
        <BackButton />
        <button
          className={`icon-button${favorite ? " favorite on" : ""}`}
          onClick={toggleFavorite}
          aria-label="Избранное"
        >
          <Heart size={21} fill={favorite ? "currentColor" : "none"} />
        </button>
      </div>
      <div
        className="hero-image"
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
        {listing.images.length > 0 && (
          <span className="gallery-count">
            {activeImage + 1} / {listing.images.length}
          </span>
        )}
      </div>
      <p className="eyebrow">
        {listing.city} · {listing.year}
      </p>
      <h1>
        {listing.make} {listing.model}
      </h1>
      {listing.generation && <p className="muted">{listing.generation}</p>}
      <p className="price-large section">{formatPrice(listing.price, listing.currency)}</p>
      <div className="details-list section">
        <div className="detail">
          <span>Пробег</span>
          <strong>{formatMileage(listing.mileage)}</strong>
        </div>
        <div className="detail">
          <span>Кузов</span>
          <strong>{listing.bodyType}</strong>
        </div>
        <div className="detail">
          <span>Топливо</span>
          <strong>{listing.fuelType}</strong>
        </div>
        <div className="detail">
          <span>Коробка</span>
          <strong>{listing.transmission}</strong>
        </div>
        <div className="detail">
          <span>Привод</span>
          <strong>{listing.drivetrain}</strong>
        </div>
        <div className="detail">
          <span>Двигатель</span>
          <strong>{listing.engineVolume ? `${listing.engineVolume} л` : "—"}</strong>
        </div>
        <div className="detail">
          <span>Мощность</span>
          <strong>{listing.horsepower ? `${listing.horsepower} л.с.` : "—"}</strong>
        </div>
        <div className="detail">
          <span>VIN</span>
          <strong>{listing.maskedVin ?? "Не указан"}</strong>
        </div>
      </div>
      <section className="panel section">
        <h2>Описание</h2>
        <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{listing.description}</p>
        <p className="muted small">
          <MapPin size={14} style={{ verticalAlign: -2 }} /> {listing.country}, {listing.city}
        </p>
      </section>
      <section className="panel section">
        <h2>Продавец</h2>
        <h3>{listing.owner?.firstName ?? "Владелец автомобиля"}</h3>
        <p className="muted small">
          <Eye size={14} style={{ verticalAlign: -2 }} /> {listing.viewCount} просмотров
        </p>
        <button className="button secondary" onClick={() => void report()}>
          <Flag size={17} /> Пожаловаться
        </button>
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
            <MessageCircle size={18} /> Telegram
          </a>
        ) : (
          <button className="button" disabled>
            Нет Telegram
          </button>
        )}
      </div>
    </>
  );
}
