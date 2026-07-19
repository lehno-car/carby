"use client";

import { MapPin, Mic, Search, SlidersHorizontal, X, Zap } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { ListingCard } from "@/components/listing-card";
import { api, formatPrice } from "@/lib/api";
import type { Listing } from "@/lib/types";

const bodies = ["Все", "Седан", "Универсал", "Хэтчбек", "Кроссовер", "Внедорожник", "Минивэн"];

export function HomeFeed() {
  const [query, setQuery] = useState("");
  const [bodyType, setBodyType] = useState("Все");
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    minYear: "",
    maxYear: "",
    minPrice: "",
    maxPrice: "",
    maxMileage: "",
    city: "",
    currency: "BYN",
    fuelType: "",
    transmission: "",
    drivetrain: "",
    sort: "newest",
  });
  const [items, setItems] = useState<Listing[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const featured = items[0];
  const heroImage = featured?.images[0]?.url.replace("variant=thumb", "variant=full");
  const title = featured ? `${featured.make} ${featured.model}` : "Автомобиль, который подходит вам";

  const load = useCallback(
    async (nextPage = 1, append = false) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ page: String(nextPage), limit: "12" });
        if (query.trim()) params.set("q", query.trim());
        if (bodyType !== "Все") params.set("bodyType", bodyType);
        Object.entries(filters).forEach(([key, value]) => {
          if (value) params.set(key, value);
        });
        const data = await api<{ items: Listing[]; page: number; hasMore: boolean }>(
          `/api/listings?${params}`,
        );
        setItems((current) => (append ? [...current, ...data.items] : data.items));
        setPage(data.page);
        setHasMore(data.hasMore);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Не удалось загрузить объявления");
      } finally {
        setLoading(false);
      }
    },
    [bodyType, filters, query],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 250);
    return () => window.clearTimeout(timer);
  }, [load]);

  function updateFilter(key: keyof typeof filters, value: string) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  const heroChips = useMemo(
    () => [
      { label: "Рядом", icon: <MapPin size={15} /> },
      { label: filters.maxPrice ? `До ${filters.maxPrice} ${filters.currency}` : "До 30 000" },
      { label: filters.fuelType || "Электро", icon: <Zap size={15} /> },
      { label: filters.minYear || "2022+" },
    ],
    [filters.currency, filters.fuelType, filters.maxPrice, filters.minYear],
  );

  return (
    <>
      <section className="home-hero">
        {heroImage ? <img src={heroImage} alt={title} /> : <div className="home-hero-fallback" />}
        <div className="home-hero-shade" />
        <div className="home-hero-top">
          <button className="location-pill" type="button">
            <MapPin size={15} /> Беларусь
          </button>
          <span className="profile-dot">CB</span>
        </div>
        <div className="home-hero-content">
          <h1>{featured ? "Автомобиль, который подходит вам" : title}</h1>
          <label className="hero-search">
            <Search size={21} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Поиск марки или модели"
              aria-label="Поиск"
            />
            {query ? (
              <button type="button" onClick={() => setQuery("")} aria-label="Очистить">
                <X size={17} />
              </button>
            ) : (
              <Mic size={19} />
            )}
          </label>
          <div className="hero-chip-row">
            {heroChips.map((chip) => (
              <button className="hero-chip" key={chip.label} type="button">
                {chip.icon}
                {chip.label}
              </button>
            ))}
            <button className="hero-chip" type="button" onClick={() => setShowFilters(!showFilters)}>
              <SlidersHorizontal size={15} />
              Фильтры
            </button>
          </div>
        </div>
      </section>

      {featured && (
        <section className="featured-card">
          <div>
            <p className="eyebrow">Выбор дня</p>
            <h2>
              {featured.make} {featured.model}
            </h2>
            <p>{formatPrice(featured.price, featured.currency)}</p>
          </div>
          <a className="icon-button" href={`/listing/${featured.id}`} aria-label="Открыть объявление">
            →
          </a>
        </section>
      )}

      <div className="chips compact">
        {bodies.map((body) => (
          <button
            key={body}
            className={`chip${bodyType === body ? " active" : ""}`}
            onClick={() => setBodyType(body)}
          >
            {body}
          </button>
        ))}
      </div>

      {showFilters && (
        <section className="panel section" aria-label="Фильтры">
          <div className="field-grid">
            <Field label="Год от" value={filters.minYear} onChange={(value) => updateFilter("minYear", value)} placeholder="2015" />
            <Field label="Год до" value={filters.maxYear} onChange={(value) => updateFilter("maxYear", value)} placeholder="2026" />
            <Field label="Цена от" value={filters.minPrice} onChange={(value) => updateFilter("minPrice", value)} />
            <Field label="Цена до" value={filters.maxPrice} onChange={(value) => updateFilter("maxPrice", value)} />
            <div className="field">
              <label>Валюта</label>
              <select className="input" value={filters.currency} onChange={(event) => updateFilter("currency", event.target.value)}>
                <option>BYN</option>
                <option>USD</option>
                <option>RUB</option>
              </select>
            </div>
            <Field label="Пробег до, км" value={filters.maxMileage} onChange={(value) => updateFilter("maxMileage", value)} />
            <div className="field">
              <label>Топливо</label>
              <select className="input" value={filters.fuelType} onChange={(event) => updateFilter("fuelType", event.target.value)}>
                <option value="">Любое</option>
                <option>Бензин</option>
                <option>Дизель</option>
                <option>Гибрид</option>
                <option>Электро</option>
              </select>
            </div>
            <Field label="Город" value={filters.city} onChange={(value) => updateFilter("city", value)} placeholder="Минск" />
          </div>
        </section>
      )}

      <section className="section">
        <div className="section-heading">
          <h2>Подобрано для вас</h2>
          <button className="link-button" type="button" onClick={() => void load()}>
            Обновить
          </button>
        </div>
        {error && <p className="notice">{error}</p>}
        {loading && !items.length ? (
          <div className="car-grid">
            <div className="skeleton" />
            <div className="skeleton" />
          </div>
        ) : null}
        {!loading && !items.length && !error ? (
          <div className="empty">
            <div>
              <h3>Пока ничего не найдено</h3>
              <p className="muted">Измените фильтры или загляните позже.</p>
            </div>
          </div>
        ) : null}
        <div className="car-grid">
          {items.map((listing) => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </div>
        {hasMore && (
          <button className="button secondary full section" disabled={loading} onClick={() => void load(page + 1, true)}>
            {loading ? "Загрузка…" : "Показать ещё"}
          </button>
        )}
      </section>
    </>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="field">
      <label>{label}</label>
      <input
        className="input"
        inputMode="numeric"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}
