"use client";

import { Camera, ChevronLeft, ChevronRight, LoaderCircle, Send } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { useAuth } from "@/components/auth-provider";
import { api } from "@/lib/api";
import type { Listing } from "@/lib/types";

const initial = {
  make: "",
  model: "",
  generation: "",
  year: String(new Date().getFullYear()),
  price: "",
  currency: "BYN",
  mileage: "",
  bodyType: "Седан",
  fuelType: "Бензин",
  transmission: "Автомат",
  drivetrain: "Передний",
  engineVolume: "",
  horsepower: "",
  color: "",
  vin: "",
  city: "Минск",
  description: "",
  sellerPhone: "",
  sellerTelegram: "",
};

export function SellForm({ editId }: { editId?: string }) {
  const router = useRouter();
  const { user, loading: authLoading, loginForDevelopment } = useAuth();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(initial);
  const [files, setFiles] = useState<File[]>([]);
  const [existingImages, setExistingImages] = useState<Listing["images"]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!editId) return;
    api<{ listing: Listing }>(`/api/listings/${editId}`)
      .then(({ listing }) => {
        setExistingImages(listing.images);
        setForm({
          make: listing.make,
          model: listing.model,
          generation: listing.generation ?? "",
          year: String(listing.year),
          price: String(listing.price),
          currency: listing.currency,
          mileage: String(listing.mileage),
          bodyType: listing.bodyType,
          fuelType: listing.fuelType,
          transmission: listing.transmission,
          drivetrain: listing.drivetrain,
          engineVolume: listing.engineVolume ?? "",
          horsepower: listing.horsepower ? String(listing.horsepower) : "",
          color: listing.color ?? "",
          vin: "",
          city: listing.city,
          description: listing.description,
          sellerPhone: listing.sellerPhone ?? "",
          sellerTelegram: listing.sellerTelegram ?? "",
        });
      })
      .catch((reason) =>
        setError(reason instanceof Error ? reason.message : "Не удалось загрузить объявление"),
      );
  }, [editId]);

  function update(name: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [name]: value }));
  }
  function next() {
    const required =
      step === 0
        ? [form.make, form.model, form.year, form.price]
        : [form.mileage, form.bodyType, form.fuelType, form.transmission, form.drivetrain];
    if (required.some((value) => !value)) {
      setError("Заполните обязательные поля");
      return;
    }
    setError(null);
    setStep((current) => Math.min(2, current + 1));
  }

  async function submit() {
    if (form.description.trim().length < 20 || !form.city) {
      setError("Укажите город и описание длиной не меньше 20 символов");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const payload = {
        ...form,
        country: "Беларусь",
        year: Number(form.year),
        price: Number(form.price),
        mileage: Number(form.mileage),
        horsepower: form.horsepower ? Number(form.horsepower) : "",
        engineVolume: form.engineVolume ? Number(form.engineVolume) : "",
      };
      const result = await api<{ listing: Listing }>(
        editId ? `/api/listings/${editId}` : "/api/listings",
        { method: editId ? "PATCH" : "POST", body: JSON.stringify(payload) },
      );
      if (files.length) {
        const data = new FormData();
        files.forEach((file) => data.append("images", file));
        await api(`/api/listings/${result.listing.id}/images`, { method: "POST", body: data });
      }
      window.Telegram?.WebApp.HapticFeedback?.impactOccurred("medium");
      router.push("/my");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось сохранить объявление");
    } finally {
      setBusy(false);
    }
  }

  async function moveImage(index: number, direction: -1 | 1) {
    if (!editId) return;
    const target = index + direction;
    if (target < 0 || target >= existingImages.length) return;
    const reordered = [...existingImages];
    [reordered[index], reordered[target]] = [reordered[target]!, reordered[index]!];
    setExistingImages(reordered);
    try {
      await api(`/api/listings/${editId}/images`, {
        method: "PATCH",
        body: JSON.stringify({ imageIds: reordered.map((image) => image.id) }),
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось изменить порядок фото");
    }
  }

  async function removeImage(imageId: string) {
    if (!editId) return;
    try {
      await api(`/api/listings/${editId}/images/${imageId}`, { method: "DELETE" });
      setExistingImages((current) => current.filter((image) => image.id !== imageId));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось удалить фото");
    }
  }

  if (!authLoading && !user)
    return (
      <>
        <PageHeader title="Продать авто" subtitle="AutoMarket" />
        <div className="empty">
          <div>
            <h3>Нужна авторизация</h3>
            <p className="muted">
              Откройте приложение через Telegram. Локально можно использовать тестовый вход.
            </p>
            <button className="button" onClick={() => void loginForDevelopment()}>
              Тестовый вход
            </button>
          </div>
        </div>
      </>
    );

  return (
    <>
      <PageHeader
        title={editId ? "Редактировать" : "Продать авто"}
        subtitle={`Шаг ${step + 1} из 3`}
      />
      <div className="stepper">
        {[0, 1, 2].map((item) => (
          <span key={item} className={`step${item <= step ? " done" : ""}`} />
        ))}
      </div>
      {error && <p className="notice">{error}</p>}
      <section className="panel">
        {step === 0 && (
          <>
            <h2>Основное</h2>
            <div className="field-grid">
              <Field
                label="Марка *"
                value={form.make}
                onChange={(v) => update("make", v)}
                placeholder="Volkswagen"
              />
              <Field
                label="Модель *"
                value={form.model}
                onChange={(v) => update("model", v)}
                placeholder="Passat"
              />
              <Field
                label="Поколение / комплектация"
                value={form.generation}
                onChange={(v) => update("generation", v)}
                full
              />
              <Field
                label="Год *"
                value={form.year}
                onChange={(v) => update("year", v)}
                inputMode="numeric"
              />
              <Field
                label="Цена *"
                value={form.price}
                onChange={(v) => update("price", v)}
                inputMode="numeric"
              />
              <Select
                label="Валюта"
                value={form.currency}
                onChange={(v) => update("currency", v)}
                options={["BYN", "USD", "RUB"]}
                full
              />
            </div>
          </>
        )}
        {step === 1 && (
          <>
            <h2>Характеристики</h2>
            <div className="field-grid">
              <Field
                label="Пробег, км *"
                value={form.mileage}
                onChange={(v) => update("mileage", v)}
                inputMode="numeric"
                full
              />
              <Select
                label="Кузов"
                value={form.bodyType}
                onChange={(v) => update("bodyType", v)}
                options={[
                  "Седан",
                  "Универсал",
                  "Хэтчбек",
                  "Кроссовер",
                  "Внедорожник",
                  "Купе",
                  "Минивэн",
                  "Пикап",
                  "Кабриолет",
                ]}
              />
              <Select
                label="Топливо"
                value={form.fuelType}
                onChange={(v) => update("fuelType", v)}
                options={["Бензин", "Дизель", "Гибрид", "Электро", "Газ"]}
              />
              <Select
                label="Коробка"
                value={form.transmission}
                onChange={(v) => update("transmission", v)}
                options={["Механика", "Автомат", "Робот", "Вариатор"]}
              />
              <Select
                label="Привод"
                value={form.drivetrain}
                onChange={(v) => update("drivetrain", v)}
                options={["Передний", "Задний", "Полный"]}
              />
              <Field
                label="Объём, л"
                value={form.engineVolume}
                onChange={(v) => update("engineVolume", v)}
                inputMode="decimal"
              />
              <Field
                label="Мощность, л.с."
                value={form.horsepower}
                onChange={(v) => update("horsepower", v)}
                inputMode="numeric"
              />
              <Field label="Цвет" value={form.color} onChange={(v) => update("color", v)} />
              <Field
                label="VIN (17 символов)"
                value={form.vin}
                onChange={(v) => update("vin", v.toUpperCase())}
                maxLength={17}
              />
            </div>
          </>
        )}
        {step === 2 && (
          <>
            <h2>Фото и контакты</h2>
            <div className="field-grid">
              <Field label="Город *" value={form.city} onChange={(v) => update("city", v)} full />
              <Field
                label="Телефон"
                value={form.sellerPhone}
                onChange={(v) => update("sellerPhone", v)}
                placeholder="+375 29 000-00-00"
              />
              <Field
                label="Telegram"
                value={form.sellerTelegram}
                onChange={(v) => update("sellerTelegram", v)}
                placeholder="username"
              />
              <label className="field full">
                <span>Описание *</span>
                <textarea
                  className="input"
                  value={form.description}
                  onChange={(e) => update("description", e.target.value)}
                  placeholder="Состояние, обслуживание, особенности…"
                />
              </label>
              {existingImages.length > 0 && (
                <div className="field full">
                  <span>Загруженные фото — задайте порядок стрелками</span>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
                    {existingImages.map((image, index) => (
                      <div key={image.id} className="panel" style={{ padding: 8 }}>
                        <img
                          src={image.url}
                          alt={`Фото ${index + 1}`}
                          style={{
                            width: "100%",
                            aspectRatio: "1.4",
                            objectFit: "cover",
                            borderRadius: 10,
                          }}
                        />
                        <div style={{ display: "flex", gap: 5, marginTop: 6 }}>
                          <button
                            className="chip"
                            onClick={() => void moveImage(index, -1)}
                            disabled={index === 0}
                          >
                            ←
                          </button>
                          <button
                            className="chip"
                            onClick={() => void moveImage(index, 1)}
                            disabled={index === existingImages.length - 1}
                          >
                            →
                          </button>
                          <button className="chip" onClick={() => void removeImage(image.id)}>
                            Удалить
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <label className="field full">
                <span>Добавить фото (всего до 10, JPEG/PNG/WebP, до 10 МБ)</span>
                <span className="button secondary">
                  <Camera size={18} /> {files.length ? `Выбрано: ${files.length}` : "Выбрать фото"}
                  <input
                    hidden
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    onChange={(e) =>
                      setFiles(
                        Array.from(e.target.files ?? []).slice(
                          0,
                          Math.max(0, 10 - existingImages.length),
                        ),
                      )
                    }
                  />
                </span>
              </label>
            </div>
          </>
        )}
        <div className="form-actions">
          {step > 0 && (
            <button className="button secondary" onClick={() => setStep(step - 1)}>
              <ChevronLeft size={18} /> Назад
            </button>
          )}
          {step < 2 ? (
            <button className="button" onClick={next}>
              Далее <ChevronRight size={18} />
            </button>
          ) : (
            <button className="button" disabled={busy} onClick={() => void submit()}>
              {busy ? <LoaderCircle className="spin" size={18} /> : <Send size={18} />}{" "}
              {editId ? "Сохранить" : "На модерацию"}
            </button>
          )}
        </div>
      </section>
    </>
  );
}

function Field({
  label,
  value,
  onChange,
  full,
  ...props
}: { label: string; value: string; onChange(value: string): void; full?: boolean } & Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange"
>) {
  return (
    <label className={`field${full ? " full" : ""}`}>
      <span>{label}</span>
      <input
        className="input"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        {...props}
      />
    </label>
  );
}
function Select({
  label,
  value,
  onChange,
  options,
  full,
}: {
  label: string;
  value: string;
  onChange(value: string): void;
  options: string[];
  full?: boolean;
}) {
  return (
    <label className={`field${full ? " full" : ""}`}>
      <span>{label}</span>
      <select className="input" value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}
