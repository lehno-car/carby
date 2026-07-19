"use client";

import { AlertCircle, Check, ChevronDown, LoaderCircle, Search, X } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";

import { api } from "@/lib/api";
import type { CatalogGeneration, CatalogMake, CatalogModel } from "@/lib/types";

type CatalogValue = {
  makeId: string;
  modelId: string;
  generationId: string;
  year?: string;
};

export function VehicleCatalogFields({
  value,
  onChange,
  showYear = true,
  allowRequest = false,
  initialNames,
}: {
  value: CatalogValue;
  onChange(patch: Partial<CatalogValue>): void;
  showYear?: boolean;
  allowRequest?: boolean;
  initialNames?: { make?: string; model?: string; generation?: string };
}) {
  const [make, setMake] = useState<CatalogMake | null>(
    value.makeId && initialNames?.make
      ? ({ id: value.makeId, name: initialNames.make } as CatalogMake)
      : null,
  );
  const [model, setModel] = useState<CatalogModel | null>(
    value.modelId && initialNames?.model
      ? ({ id: value.modelId, makeId: value.makeId, name: initialNames.model } as CatalogModel)
      : null,
  );
  const [generation, setGeneration] = useState<CatalogGeneration | null>(
    value.generationId && initialNames?.generation
      ? ({
          id: value.generationId,
          modelId: value.modelId,
          name: initialNames.generation,
        } as CatalogGeneration)
      : null,
  );
  const [showRequest, setShowRequest] = useState(false);
  const [yearNotice, setYearNotice] = useState<string | null>(null);

  useEffect(() => {
    if (value.makeId && make?.id !== value.makeId) {
      void api<{ item: CatalogMake }>(`/api/catalog/makes/${value.makeId}`)
        .then(({ item }) => setMake(item))
        .catch(() => setMake(null));
    }
  }, [make?.id, value.makeId]);
  useEffect(() => {
    if (value.modelId && model?.id !== value.modelId) {
      void api<{ item: CatalogModel }>(`/api/catalog/models/${value.modelId}`)
        .then(({ item }) => setModel(item))
        .catch(() => setModel(null));
    }
  }, [model?.id, value.modelId]);
  useEffect(() => {
    if (value.generationId && generation?.id !== value.generationId) {
      void api<{ item: CatalogGeneration }>(`/api/catalog/generations/${value.generationId}`)
        .then(({ item }) => setGeneration(item))
        .catch(() => setGeneration(null));
    }
  }, [generation?.id, value.generationId]);

  function selectMake(next: CatalogMake | null) {
    setMake(next);
    setModel(null);
    setGeneration(null);
    setYearNotice(null);
    onChange({ makeId: next?.id ?? "", modelId: "", generationId: "" });
  }

  function selectModel(next: CatalogModel | null) {
    setModel(next);
    setGeneration(null);
    setYearNotice(null);
    onChange({ modelId: next?.id ?? "", generationId: "" });
  }

  function selectGeneration(next: CatalogGeneration | null) {
    setGeneration(next);
    setYearNotice(next && value.year ? generationYearWarning(next, Number(value.year)) : null);
    onChange({ generationId: next?.id ?? "" });
  }

  const generationWarning =
    generation && value.year ? generationYearWarning(generation, Number(value.year)) : null;

  return (
    <>
      <CatalogCombobox<CatalogMake>
        label="Марка *"
        selected={make}
        endpoint="/api/catalog/makes"
        placeholder="Начните вводить марку"
        onSelect={selectMake}
        getMeta={(item) => `${item.activeListingCount ?? 0} объявлений`}
      />
      <CatalogCombobox<CatalogModel>
        label="Модель *"
        selected={model}
        endpoint={make ? `/api/catalog/makes/${make.id}/models` : null}
        placeholder={make ? "Начните вводить модель" : "Сначала выберите марку"}
        onSelect={selectModel}
        getMeta={(item) => `${item.activeListingCount ?? 0} объявлений`}
      />
      {showYear && (
        <label className="field">
          <span>Год выпуска *</span>
          <input
            className="input"
            inputMode="numeric"
            value={value.year ?? ""}
            onChange={(event) => {
              const nextYear = event.target.value;
              const warning = generation
                ? generationYearWarning(generation, Number(nextYear))
                : null;
              setYearNotice(warning);
              if (generation && warning) {
                setGeneration(null);
                onChange({ year: nextYear, generationId: "" });
              } else {
                onChange({ year: nextYear });
              }
            }}
          />
        </label>
      )}
      <CatalogCombobox<CatalogGeneration>
        label="Поколение"
        selected={generation}
        endpoint={
          model
            ? `/api/catalog/models/${model.id}/generations${value.year ? `?year=${encodeURIComponent(value.year)}` : ""}`
            : null
        }
        placeholder={model ? "Не знаю поколение" : "Сначала выберите модель"}
        onSelect={selectGeneration}
        optional
        getMeta={(item) =>
          [
            item.code,
            item.productionStartYear || item.productionEndYear
              ? `${item.productionStartYear ?? "?"}–${item.productionEndYear ?? "н.в."}`
              : null,
          ]
            .filter(Boolean)
            .join(" · ") || null
        }
      />
      {(yearNotice || generationWarning) && (
        <p className="catalog-warning full">{yearNotice || generationWarning}</p>
      )}
      {allowRequest && (
        <div className="full">
          <button
            className="link-button"
            type="button"
            onClick={() => setShowRequest((open) => !open)}
          >
            <AlertCircle size={16} /> Нет моей модели или поколения
          </button>
          {showRequest && (
            <CatalogChangeRequestForm
              makeId={value.makeId || null}
              modelId={value.modelId || null}
              generationId={value.generationId || null}
              onDone={() => setShowRequest(false)}
            />
          )}
        </div>
      )}
    </>
  );
}

function CatalogCombobox<T extends { id: string; name: string }>({
  label,
  selected,
  endpoint,
  placeholder,
  onSelect,
  optional = false,
  getMeta,
}: {
  label: string;
  selected: T | null;
  endpoint: string | null;
  placeholder: string;
  onSelect(item: T | null): void;
  optional?: boolean;
  getMeta?: (item: T) => string | null;
}) {
  const [query, setQuery] = useState(selected?.name ?? "");
  const [items, setItems] = useState<T[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const optionsId = useId();
  const selectedName = selected?.name ?? "";

  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(selectedName), 0);
    return () => window.clearTimeout(timer);
  }, [selectedName]);
  const load = useCallback(async () => {
    if (!endpoint) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    try {
      const separator = endpoint.includes("?") ? "&" : "?";
      const data = await api<{ items: T[] }>(
        `${endpoint}${separator}query=${encodeURIComponent(selectedName === query ? "" : query)}&limit=50`,
        { signal: controller.signal },
      );
      setItems(data.items);
    } catch (reason) {
      if (!(reason instanceof DOMException && reason.name === "AbortError")) setItems([]);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [endpoint, query, selectedName]);

  useEffect(() => {
    if (!open || !endpoint) return;
    const timer = window.setTimeout(() => void load(), 250);
    return () => window.clearTimeout(timer);
  }, [endpoint, load, open]);
  useEffect(() => () => abortRef.current?.abort(), []);

  return (
    <div className="field catalog-combobox">
      <span>{label}</span>
      <span className="catalog-input-wrap">
        <Search size={17} />
        <input
          className="input"
          role="combobox"
          aria-controls={optionsId}
          aria-expanded={open}
          disabled={!endpoint}
          value={query}
          placeholder={placeholder}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            if (selected) onSelect(null);
          }}
        />
        {loading ? <LoaderCircle className="spin" size={17} /> : <ChevronDown size={17} />}
      </span>
      {open && endpoint && (
        <span className="catalog-options" id={optionsId} role="listbox">
          {optional && (
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onSelect(null);
                setOpen(false);
              }}
            >
              <X size={15} /> Не знаю поколение
            </button>
          )}
          {items.map((item) => (
            <button
              type="button"
              role="option"
              aria-selected={selected?.id === item.id}
              key={item.id}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onSelect(item);
                setQuery(item.name);
                setOpen(false);
              }}
            >
              <span className="catalog-option-copy">
                <span>{item.name}</span>
                {getMeta?.(item) && <small>{getMeta(item)}</small>}
              </span>
              {selected?.id === item.id && <Check size={15} />}
            </button>
          ))}
          {!loading && !items.length && <small>Ничего не найдено</small>}
        </span>
      )}
    </div>
  );
}

function generationYearWarning(generation: CatalogGeneration, year: number) {
  if (!Number.isInteger(year)) return null;
  if (
    (generation.productionStartYear && year < generation.productionStartYear) ||
    (generation.productionEndYear && year > generation.productionEndYear)
  ) {
    return `Год вне периода поколения: ${generation.productionStartYear ?? "?"}–${generation.productionEndYear ?? "н.в."}`;
  }
  return null;
}

function CatalogChangeRequestForm({
  makeId,
  modelId,
  generationId,
  onDone,
}: {
  makeId: string | null;
  modelId: string | null;
  generationId: string | null;
  onDone(): void;
}) {
  const [requestType, setRequestType] = useState("missing_model");
  const [comment, setComment] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  async function submit() {
    try {
      await api("/api/catalog/change-requests", {
        method: "POST",
        body: JSON.stringify({ requestType, makeId, modelId, generationId, comment }),
      });
      setMessage("Запрос отправлен администратору");
      window.setTimeout(onDone, 900);
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Не удалось отправить запрос");
    }
  }

  return (
    <div className="catalog-request">
      <select
        className="input"
        value={requestType}
        onChange={(event) => setRequestType(event.target.value)}
      >
        <option value="missing_make">Нет марки</option>
        <option value="missing_model">Нет модели</option>
        <option value="missing_generation">Нет поколения</option>
        <option value="incorrect_years">Неверные годы</option>
        <option value="duplicate">Дубликат</option>
        <option value="other">Другое</option>
      </select>
      <textarea
        className="input"
        value={comment}
        onChange={(event) => setComment(event.target.value)}
        placeholder="Опишите, что нужно добавить или исправить"
      />
      {message && <p className="small">{message}</p>}
      <button
        className="button secondary"
        type="button"
        disabled={comment.trim().length < 10}
        onClick={() => void submit()}
      >
        Отправить запрос
      </button>
    </div>
  );
}
