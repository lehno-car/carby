"use client";

import { SlidersHorizontal, Search, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { ListingCard } from "@/components/listing-card";
import { PageHeader } from "@/components/page-header";
import { api } from "@/lib/api";
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
        setError(
          loadError instanceof Error ? loadError.message : "Не удалось загрузить объявления",
        );
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

  return (
    <>
      <PageHeader title="AutoMarket" subtitle="Автомобили · Беларусь" />
      <div className="search-row">
        <label className="search-box">
          <Search size={20} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Марка или модель"
            aria-label="Поиск"
          />
          {query && (
            <button
              className="icon-button"
              style={{ width: 30, height: 30, boxShadow: "none" }}
              onClick={() => setQuery("")}
              aria-label="Очистить"
            >
              <X size={16} />
            </button>
          )}
        </label>
        <button
          className="icon-button"
          onClick={() => setShowFilters(!showFilters)}
          aria-label="Фильтры"
        >
          <SlidersHorizontal size={21} />
        </button>
      </div>

      <div className="chips">
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
            <div className="field">
              <label>Год от</label>
              <input
                className="input"
                inputMode="numeric"
                value={filters.minYear}
                onChange={(event) => updateFilter("minYear", event.target.value)}
                placeholder="2015"
              />
            </div>
            <div className="field">
              <label>Год до</label>
              <input
                className="input"
                inputMode="numeric"
                value={filters.maxYear}
                onChange={(event) => updateFilter("maxYear", event.target.value)}
                placeholder="2026"
              />
            </div>
            <div className="field">
              <label>Цена от</label>
              <input
                className="input"
                inputMode="numeric"
                value={filters.minPrice}
                onChange={(event) => updateFilter("minPrice", event.target.value)}
              />
            </div>
            <div className="field">
              <label>Цена до</label>
              <input
                className="input"
                inputMode="numeric"
                value={filters.maxPrice}
                onChange={(event) => updateFilter("maxPrice", event.target.value)}
              />
            </div>
            <div className="field">
              <label>Валюта</label>
              <select
                className="input"
                value={filters.currency}
                onChange={(event) => updateFilter("currency", event.target.value)}
              >
                <option>BYN</option>
                <option>USD</option>
                <option>RUB</option>
              </select>
            </div>
            <div className="field">
              <label>Пробег до, км</label>
              <input
                className="input"
                inputMode="numeric"
                value={filters.maxMileage}
                onChange={(event) => updateFilter("maxMileage", event.target.value)}
              />
            </div>
            <div className="field">
              <label>Топливо</label>
              <select
                className="input"
                value={filters.fuelType}
                onChange={(event) => updateFilter("fuelType", event.target.value)}
              >
                <option value="">Любое</option>
                <option>Бензин</option>
                <option>Дизель</option>
                <option>Гибрид</option>
                <option>Электро</option>
              </select>
            </div>
            <div className="field">
              <label>Коробка</label>
              <select
                className="input"
                value={filters.transmission}
                onChange={(event) => updateFilter("transmission", event.target.value)}
              >
                <option value="">Любая</option>
                <option>Механика</option>
                <option>Автомат</option>
                <option>Робот</option>
                <option>Вариатор</option>
              </select>
            </div>
            <div className="field">
              <label>Привод</label>
              <select
                className="input"
                value={filters.drivetrain}
                onChange={(event) => updateFilter("drivetrain", event.target.value)}
              >
                <option value="">Любой</option>
                <option>Передний</option>
                <option>Задний</option>
                <option>Полный</option>
              </select>
            </div>
            <div className="field">
              <label>Город</label>
              <input
                className="input"
                value={filters.city}
                onChange={(event) => updateFilter("city", event.target.value)}
                placeholder="Минск"
              />
            </div>
            <div className="field full">
              <label>Сортировка</label>
              <select
                className="input"
                value={filters.sort}
                onChange={(event) => updateFilter("sort", event.target.value)}
              >
                <option value="newest">Сначала новые</option>
                <option value="price_asc">Цена: по возрастанию</option>
                <option value="price_desc">Цена: по убыванию</option>
                <option value="mileage_asc">Меньший пробег</option>
              </select>
            </div>
          </div>
        </section>
      )}

      <section className="section">
        <h2>Свежие объявления</h2>
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
          <button
            className="button secondary full section"
            disabled={loading}
            onClick={() => void load(page + 1, true)}
          >
            {loading ? "Загрузка…" : "Показать ещё"}
          </button>
        )}
      </section>
    </>
  );
}
