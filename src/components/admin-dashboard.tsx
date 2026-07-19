"use client";

import { Database, GitMerge, ListChecks, Pencil, Plus, ShieldCheck, Tags } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { BackButton } from "@/components/back-button";
import { ModerationScreen } from "@/components/moderation-screen";
import { api } from "@/lib/api";

type Tab = "catalog" | "requests" | "imports" | "moderation";
type Entity = "make" | "model" | "generation";
type CatalogItem = {
  id: string;
  name: string;
  isActive: boolean;
  isFeatured?: boolean;
  isSpecial?: boolean;
  sourceName: string;
  externalId: string;
  sourceUrl?: string | null;
  productionStartYear?: number | null;
  productionEndYear?: number | null;
  code?: string | null;
  activeListingCount?: number;
};

export function AdminDashboard() {
  const [tab, setTab] = useState<Tab>("catalog");
  return (
    <>
      <header className="page-header">
        <BackButton />
        <div style={{ flex: 1 }}>
          <p className="eyebrow">Администратор</p>
          <h1>Управление</h1>
        </div>
        <ShieldCheck color="var(--accent)" />
      </header>
      <div className="admin-tabs" role="tablist">
        <AdminTab
          active={tab === "catalog"}
          onClick={() => setTab("catalog")}
          icon={<Tags size={16} />}
          label="Каталог"
        />
        <AdminTab
          active={tab === "requests"}
          onClick={() => setTab("requests")}
          icon={<ListChecks size={16} />}
          label="Запросы"
        />
        <AdminTab
          active={tab === "imports"}
          onClick={() => setTab("imports")}
          icon={<Database size={16} />}
          label="Импорты"
        />
        <AdminTab
          active={tab === "moderation"}
          onClick={() => setTab("moderation")}
          icon={<ShieldCheck size={16} />}
          label="Объявления"
        />
      </div>
      {tab === "catalog" && <CatalogManager />}
      {tab === "requests" && <RequestsManager />}
      {tab === "imports" && <ImportJournal />}
      {tab === "moderation" && <ModerationScreen embedded />}
    </>
  );
}

function AdminTab({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick(): void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button className={active ? "active" : ""} type="button" onClick={onClick}>
      {icon}
      {label}
    </button>
  );
}

function CatalogManager() {
  const [level, setLevel] = useState<Entity>("make");
  const [parent, setParent] = useState<{ make?: CatalogItem; model?: CatalogItem }>({});
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ view: `${level}s`, query, limit: "100" });
      if (level === "model" && parent.make) params.set("makeId", parent.make.id);
      if (level === "generation" && parent.model) params.set("modelId", parent.model.id);
      const data = await api<{ items: CatalogItem[] }>(`/api/admin/catalog?${params}`);
      setItems(data.items);
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось загрузить каталог");
    } finally {
      setLoading(false);
    }
  }, [level, parent.make, parent.model, query]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 200);
    return () => window.clearTimeout(timer);
  }, [load]);

  function open(item: CatalogItem) {
    if (level === "make") {
      setParent({ make: item });
      setLevel("model");
    } else if (level === "model") {
      setParent((current) => ({ ...current, model: item }));
      setLevel("generation");
    }
  }

  async function createItem() {
    const name = prompt(
      `Название: ${level === "make" ? "марка" : level === "model" ? "модель" : "поколение"}`,
    )?.trim();
    if (!name) return;
    const payload: Record<string, unknown> = { action: "create", entity: level, name };
    if (level === "model") payload.makeId = parent.make?.id;
    if (level === "generation") {
      payload.modelId = parent.model?.id;
      const start = prompt("Год начала (можно оставить пустым)")?.trim();
      const end = prompt("Год окончания (можно оставить пустым)")?.trim();
      payload.productionStartYear = start ? Number(start) : null;
      payload.productionEndYear = end ? Number(end) : null;
    }
    await mutate({ method: "POST", body: payload });
  }

  async function edit(item: CatalogItem) {
    const name = prompt("Новое название", item.name)?.trim();
    if (!name || name === item.name) return;
    await mutate({ method: "PATCH", body: { entity: level, id: item.id, name } });
  }

  async function addAlias(item: CatalogItem) {
    const alias = prompt(`Алиас для «${item.name}»`)?.trim();
    if (!alias) return;
    await mutate({ method: "POST", body: { action: "alias", entity: level, id: item.id, alias } });
  }

  async function merge(item: CatalogItem) {
    const targetId = prompt(
      `ID записи, в которую объединить «${item.name}»\nИсходная запись станет неактивной.`,
    )?.trim();
    if (!targetId || !confirm("Перенести ссылки и деактивировать исходную запись?")) return;
    await mutate({
      method: "POST",
      body: { action: "merge", entity: level, sourceId: item.id, targetId },
    });
  }

  async function mutate(options: { method: "POST" | "PATCH"; body: Record<string, unknown> }) {
    try {
      await api("/api/admin/catalog", {
        method: options.method,
        body: JSON.stringify(options.body),
      });
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Операция не выполнена");
    }
  }

  return (
    <section className="section">
      <div className="catalog-breadcrumbs">
        <button
          type="button"
          onClick={() => {
            setLevel("make");
            setParent({});
          }}
        >
          Марки
        </button>
        {parent.make && (
          <button
            type="button"
            onClick={() => {
              setLevel("model");
              setParent({ make: parent.make });
            }}
          >
            {parent.make.name}
          </button>
        )}
        {parent.model && <span>{parent.model.name}</span>}
      </div>
      <div className="section-heading">
        <input
          className="input"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Поиск в этом разделе"
        />
        <button className="button" type="button" onClick={() => void createItem()}>
          <Plus size={17} /> Добавить
        </button>
      </div>
      {error && <p className="notice">{error}</p>}
      {loading && <div className="skeleton" />}
      <div className="admin-list">
        {items.map((item) => (
          <article className="panel admin-row" key={item.id}>
            <button
              className="admin-row-main"
              type="button"
              onClick={() => open(item)}
              disabled={level === "generation"}
            >
              <strong>{item.name}</strong>
              <small>
                {item.code ? `${item.code} · ` : ""}
                {item.productionStartYear || item.productionEndYear
                  ? `${item.productionStartYear ?? "?"}–${item.productionEndYear ?? "н.в."} · `
                  : ""}
                {item.sourceName} · {item.activeListingCount ?? 0} объявл.
              </small>
              <code title={item.id}>{item.id}</code>
            </button>
            <div className="admin-row-actions">
              {level === "make" && (
                <button
                  className={`chip${item.isFeatured ? " active" : ""}`}
                  type="button"
                  onClick={() =>
                    void mutate({
                      method: "PATCH",
                      body: { entity: level, id: item.id, isFeatured: !item.isFeatured },
                    })
                  }
                >
                  В топе
                </button>
              )}
              <button
                className={`chip${item.isActive ? " active" : ""}`}
                type="button"
                onClick={() =>
                  void mutate({
                    method: "PATCH",
                    body: { entity: level, id: item.id, isActive: !item.isActive },
                  })
                }
              >
                {item.isActive ? "Активна" : "Выключена"}
              </button>
              <button
                className="icon-button"
                type="button"
                title="Редактировать"
                onClick={() => void edit(item)}
              >
                <Pencil size={16} />
              </button>
              <button
                className="icon-button"
                type="button"
                title="Добавить алиас"
                onClick={() => void addAlias(item)}
              >
                <Tags size={16} />
              </button>
              <button
                className="icon-button"
                type="button"
                title="Объединить"
                onClick={() => void merge(item)}
              >
                <GitMerge size={16} />
              </button>
            </div>
            {item.sourceUrl && (
              <a className="link-button" href={item.sourceUrl} target="_blank" rel="noreferrer">
                Открыть источник
              </a>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

type ChangeRequest = {
  request: {
    id: string;
    requestType: string;
    comment: string;
    status: string;
    createdAt: string;
    adminResponse: string | null;
  };
  user: { firstName: string; username: string | null };
};

function RequestsManager() {
  const [items, setItems] = useState<ChangeRequest[]>([]);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(
    () =>
      api<{ items: ChangeRequest[] }>("/api/catalog/change-requests")
        .then((data) => setItems(data.items))
        .catch((reason) => setError(reason instanceof Error ? reason.message : "Ошибка загрузки")),
    [],
  );
  useEffect(() => {
    void load();
  }, [load]);
  async function decide(id: string, status: "in_review" | "resolved" | "rejected") {
    const adminResponse =
      status === "in_review" ? null : prompt("Комментарий пользователю")?.trim() || null;
    await api(`/api/catalog/change-requests/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status, adminResponse }),
    });
    await load();
  }
  return (
    <section className="section admin-list">
      {error && <p className="notice">{error}</p>}
      {items.map(({ request, user }) => (
        <article className="panel" key={request.id}>
          <p className="eyebrow">
            {request.requestType} · {new Date(request.createdAt).toLocaleString("ru")}
          </p>
          <h3>
            {user.firstName}
            {user.username ? ` · @${user.username}` : ""}
          </h3>
          <p>{request.comment}</p>
          <p className="muted">Статус: {request.status}</p>
          <div className="form-actions">
            <button
              className="button secondary"
              onClick={() => void decide(request.id, "in_review")}
            >
              В работу
            </button>
            <button className="button" onClick={() => void decide(request.id, "resolved")}>
              Решено
            </button>
            <button className="button danger" onClick={() => void decide(request.id, "rejected")}>
              Отклонить
            </button>
          </div>
        </article>
      ))}
    </section>
  );
}

type ImportItem = {
  id: string;
  sourceName: string;
  sourceVersion: string;
  status: string;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  errorCount: number;
  startedAt: string;
  finishedAt: string | null;
  report: unknown;
};
function ImportJournal() {
  const [items, setItems] = useState<ImportItem[]>([]);
  const [preview, setPreview] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api<{ items: ImportItem[] }>("/api/admin/catalog?view=imports")
      .then((data) => setItems(data.items))
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Ошибка загрузки"));
  }, []);
  return (
    <section className="section admin-list">
      <div className="section-heading">
        <div>
          <h2>Журнал импорта</h2>
          <p className="muted">Предпросмотр ничего не записывает в базу.</p>
        </div>
        <button
          className="button secondary"
          type="button"
          onClick={() =>
            void api("/api/admin/catalog?view=preview")
              .then(setPreview)
              .catch((reason) =>
                setError(reason instanceof Error ? reason.message : "Ошибка предпросмотра"),
              )
          }
        >
          Предпросмотр
        </button>
      </div>
      {error && <p className="notice">{error}</p>}
      {preview != null && <pre className="admin-report">{JSON.stringify(preview, null, 2)}</pre>}
      {items.map((item) => (
        <details className="panel" key={item.id}>
          <summary>
            <strong>
              {item.sourceName} · {item.sourceVersion}
            </strong>
            <span className="muted">
              {item.status} · {new Date(item.startedAt).toLocaleString("ru")}
            </span>
          </summary>
          <p>
            Создано: {item.createdCount} · обновлено: {item.updatedCount} · пропущено:{" "}
            {item.skippedCount} · ошибок: {item.errorCount}
          </p>
          <pre className="admin-report">{JSON.stringify(item.report, null, 2)}</pre>
        </details>
      ))}
      {!items.length && !error && (
        <div className="empty">
          <p>Импортов пока нет.</p>
        </div>
      )}
    </section>
  );
}
