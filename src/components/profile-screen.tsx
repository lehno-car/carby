"use client";

import { LogIn, LogOut, RefreshCw, ShieldCheck, UserRound } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { useAuth } from "@/components/auth-provider";
import { PageHeader } from "@/components/page-header";
import { api } from "@/lib/api";
import type { SafeUser } from "@/lib/types";

export function ProfileScreen() {
  const { user, loading, error, loginForDevelopment, refresh } = useAuth();
  const [phoneOverride, setPhoneOverride] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const phone = phoneOverride ?? user?.phone ?? "";

  async function save() {
    try {
      await api<{ user: SafeUser }>("/api/profile", {
        method: "PATCH",
        body: JSON.stringify({ phone }),
      });
      setMessage("Профиль сохранён");
      await refresh();
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Не удалось сохранить");
    }
  }
  async function logout() {
    await api("/api/auth/logout", { method: "POST" });
    location.reload();
  }

  return (
    <>
      <PageHeader title="Профиль" subtitle="AutoMarket" />
      {loading && <div className="skeleton" />}
      {!loading && !user && (
        <div className="empty">
          <div>
            <UserRound size={44} />
            <h3>Вы не авторизованы</h3>
            <p className="muted">В Telegram вход произойдёт автоматически.</p>
            {error && <p className="error small">{error}</p>}
            {process.env.NODE_ENV === "development" ? (
              <button className="button" onClick={() => void loginForDevelopment()}>
                <LogIn size={18} /> Тестовый вход
              </button>
            ) : (
              <button className="button" onClick={() => void refresh()}>
                <RefreshCw size={18} /> Повторить авторизацию
              </button>
            )}
          </div>
        </div>
      )}
      {user && (
        <>
          <section className="panel">
            <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
              {user.photoUrl ? (
                <img
                  src={user.photoUrl}
                  width={58}
                  height={58}
                  style={{ borderRadius: 18, objectFit: "cover" }}
                  alt="Фото профиля"
                />
              ) : (
                <span className="brand-mark" style={{ width: 58, height: 58 }}>
                  <UserRound />
                </span>
              )}
              <div>
                <h2 style={{ marginBottom: 3 }}>
                  {user.firstName} {user.lastName}
                </h2>
                <p className="muted small">
                  {user.username ? `@${user.username}` : "Telegram ID: " + user.telegramId}
                </p>
              </div>
            </div>
            <div className="field section">
              <label>Телефон для связи</label>
              <input
                className="input"
                value={phone}
                onChange={(event) => setPhoneOverride(event.target.value)}
                placeholder="+375 29 000-00-00"
              />
            </div>
            {message && <p className="small">{message}</p>}
            <button className="button full" onClick={() => void save()}>
              Сохранить
            </button>
          </section>
          {user.role === "admin" && (
            <Link
              href="/admin"
              className="panel section"
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}
            >
              <span>
                <strong>Модерация</strong>
                <br />
                <small className="muted">Очередь новых объявлений</small>
              </span>
              <ShieldCheck color="var(--accent)" />
            </Link>
          )}
          <button className="button secondary full section" onClick={() => void logout()}>
            <LogOut size={18} /> Выйти
          </button>
        </>
      )}
    </>
  );
}
